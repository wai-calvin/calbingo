/* ============================================================================
 * CalBingo — persistence seam
 *
 * The single place the game talks to for save/load. Two backends behind one API:
 *   • Supabase (when js/config.js is filled in AND a session code is in play) —
 *     durable, cross-device, and the source of the host's live leaderboard.
 *   • localStorage (always) — an instant, offline-proof cache. Writes go here
 *     first so marking a square never waits on the network, and it's the sole
 *     store when there's no backend / no code / no signal.
 *
 * Nothing here knows the bingo rules — the game passes in the state blob plus a
 * little derived meta ({ markCount, hasWon }) so the leaderboard can sort.
 * ==========================================================================*/
window.CalBingoStore = (function () {
  "use strict";

  var cfg = window.CALBINGO_SUPABASE || {};
  var hasBackend = !!(cfg.url && cfg.anonKey);
  var client = null;
  var cloudOk = hasBackend;   // flipped off if the client can't be created / a call throws

  if (hasBackend && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 5 } },
      });
    } catch (e) { client = null; cloudOk = false; }
  } else if (hasBackend) {
    cloudOk = false;          // configured but the vendored client didn't load
  }

  var SLOT_PREFIX = "calbingo.slot.";
  var SAVE_DEBOUNCE_MS = 600;

  /* ---- helpers ----------------------------------------------------------- */

  function normName(name) { return String(name || "").trim().toLowerCase(); }
  function normCode(code) { return String(code || "").trim().toUpperCase(); }

  function slotKey(code, name) {
    return SLOT_PREFIX + (normCode(code) || "SOLO") + "." + normName(name);
  }

  function readLocal(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function writeLocal(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* quota / disabled */ }
  }

  // Is a given player ref backed by the cloud right now?
  function isCloud(code) { return !!(client && cloudOk && normCode(code)); }

  /* ---- player: resolve (load-or-create) ---------------------------------- */

  // Resolve the player's card for {code, name}. Returns a ref plus the state to
  // render. `fresh` is a freshly-built card used only when this is a new player.
  //   → { ref: {key, code, name, id}, state, resumed, cloud }
  async function resolvePlayer(opts) {
    var code = normCode(opts.code);
    var name = String(opts.name || "").trim();
    var fresh = opts.fresh;
    var key = slotKey(code, name);
    var ref = { key: key, code: code, name: name, id: null };

    if (isCloud(code)) {
      try {
        // Make sure the session row exists so the players FK holds even if the
        // code was typed in manually (host normally creates it first).
        await client.from("sessions").upsert({ code: code }, { onConflict: "code", ignoreDuplicates: true });

        var found = await client
          .from("players")
          .select("id, card")
          .eq("session_code", code)
          .eq("name_key", normName(name))
          .maybeSingle();

        if (!found.error && found.data) {           // returning player — resume
          ref.id = found.data.id;
          var state = found.data.card || fresh;
          writeLocal(key, state);
          return { ref: ref, state: state, resumed: true, cloud: true };
        }

        // New player — insert the fresh card and keep its id for later updates.
        var ins = await client
          .from("players")
          .insert({ session_code: code, name: name, name_key: normName(name), card: fresh, mark_count: 0 })
          .select("id")
          .single();
        if (!ins.error && ins.data) {
          ref.id = ins.data.id;
          writeLocal(key, fresh);
          return { ref: ref, state: fresh, resumed: false, cloud: true };
        }
        // fall through to local on any cloud error
        cloudOk = false;
      } catch (e) { cloudOk = false; }
    }

    // Local path (no backend / no code / offline): resume the cached card if the
    // player already started one, else deal fresh.
    var cached = readLocal(key);
    if (cached && Array.isArray(cached.order)) {
      return { ref: ref, state: cached, resumed: true, cloud: false };
    }
    writeLocal(key, fresh);
    return { ref: ref, state: fresh, resumed: false, cloud: false };
  }

  /* ---- player: save (debounced dual-write) ------------------------------- */

  var saveTimers = {};   // key -> timeout id
  var wonStamped = {};   // key -> true once we've recorded won_at (stamp once)

  function pushCloud(ref, state, meta) {
    if (!isCloud(ref.code) || !ref.id) return;
    var patch = {
      card: state,
      mark_count: meta && meta.markCount ? meta.markCount : 0,
      has_won: !!(meta && meta.hasWon),
      updated_at: new Date().toISOString(),
    };
    if (patch.has_won && !wonStamped[ref.key]) {
      patch.won_at = new Date().toISOString();
      wonStamped[ref.key] = true;
    }
    try {
      client.from("players").update(patch).eq("id", ref.id).then(function (res) {
        if (res && res.error) cloudOk = false;
      }, function () { cloudOk = false; });
    } catch (e) { cloudOk = false; }
  }

  // Local cache is written synchronously (instant, offline-safe); the cloud
  // upsert is debounced so a burst of marks becomes one write.
  function savePlayer(ref, state, meta) {
    if (!ref || !ref.key) return;
    writeLocal(ref.key, state);
    if (!isCloud(ref.code) || !ref.id) return;
    if (saveTimers[ref.key]) clearTimeout(saveTimers[ref.key]);
    saveTimers[ref.key] = setTimeout(function () {
      saveTimers[ref.key] = null;
      pushCloud(ref, state, meta);
    }, SAVE_DEBOUNCE_MS);
  }

  /* ---- host: sessions + leaderboard -------------------------------------- */

  var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  function randomCode(len) {
    var s = "";
    for (var i = 0; i < (len || 4); i++) {
      s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return s;
  }

  // Create a fresh session and return its code. Retries on the rare collision.
  async function createSession(opts) {
    if (!client || !cloudOk) throw new Error("Supabase is not configured — see js/config.js.");
    var title = (opts && opts.title) || null;
    for (var attempt = 0; attempt < 6; attempt++) {
      var code = randomCode(4);
      var res = await client.from("sessions").insert({ code: code, title: title }).select("code").single();
      if (!res.error && res.data) return res.data.code;
      // 23505 = unique_violation → try another code; anything else is fatal.
      if (!res.error || res.error.code !== "23505") {
        if (res.error) throw new Error(res.error.message || "Could not create the session.");
      }
    }
    throw new Error("Could not allocate a session code — please try again.");
  }

  async function fetchLeaderboard(code) {
    if (!client || !cloudOk) return [];
    var res = await client
      .from("players")
      .select("name, mark_count, has_won, won_at, updated_at")
      .eq("session_code", normCode(code))
      .order("has_won", { ascending: false })
      .order("mark_count", { ascending: false })
      .order("updated_at", { ascending: true });
    return (res && !res.error && res.data) ? res.data : [];
  }

  // Subscribe to live row changes for a session. `onChange` fires on any
  // insert/update/delete; the host re-pulls the (small) leaderboard to re-sort.
  // Returns an unsubscribe function.
  function subscribeLeaderboard(code, onChange) {
    if (!client || !cloudOk) return function () {};
    var ch = client
      .channel("lb-" + normCode(code))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "players", filter: "session_code=eq." + normCode(code) },
        function (payload) { try { onChange(payload); } catch (e) { /* ignore */ } })
      .subscribe();
    return function () { try { client.removeChannel(ch); } catch (e) { /* ignore */ } };
  }

  return {
    hasBackend: hasBackend,
    isCloud: isCloud,
    resolvePlayer: resolvePlayer,
    savePlayer: savePlayer,
    createSession: createSession,
    fetchLeaderboard: fetchLeaderboard,
    subscribeLeaderboard: subscribeLeaderboard,
  };
})();
