/* ============================================================================
 * CalBingo — game logic
 *   • builds a randomized 6x6 card from window.CALBINGO_PROMPTS
 *   • one FREE space, pre-marked, at the middle (row 2, col 2)
 *   • tap a square to open it, type WHO you found, save -> square marks + shows the name
 *   • progress (marks + names) saved to localStorage
 *   • detects a win on any full row / column / diagonal
 * ==========================================================================*/
(function () {
  "use strict";

  const SIZE = 6;
  const CELLS = SIZE * SIZE;         // 36
  const FREE_INDEX = 14;             // row 2, col 2 (0-based) — sits on main diagonal
  const NEEDED_PROMPTS = CELLS - 1;  // 35
  const USER_KEY = "calbingo.username";   // player's name (kept separate from the card)
  const QUIZ_INTERVAL = 2;           // show a checkpoint after every N marks (until a win)
  const QUIZ_FEEDBACK_MS = 1500;     // how long the answer feedback stays up
  const SWAP_MS = 500;               // swap-animation duration (matches CSS)
  const MARK_POP_MS = 460;           // let the square's mark/✓ pop finish before a checkpoint pops up (matches CSS cell-pop)

  const PROMPTS = window.CALBINGO_PROMPTS || [];
  const FREE_LABEL = window.CALBINGO_FREE_LABEL || "FREE";
  const QUIZ = window.CALBINGO_QUIZ || [];

  const els = {
    board: document.getElementById("board"),
    error: document.getElementById("setup-error"),
    finale: document.getElementById("finale"),
    finaleDone: document.getElementById("finale-done"),
    finaleClose: document.getElementById("finale-close"),
    newCard: document.getElementById("new-card"),
    modal: document.getElementById("prompt-modal"),
    modalText: document.getElementById("prompt-modal-text"),
    modalInput: document.getElementById("prompt-modal-input"),
    modalSave: document.getElementById("prompt-modal-save"),
    modalUnmark: document.getElementById("prompt-modal-unmark"),
    modalClose: document.getElementById("prompt-modal-close"),
    quiz: document.getElementById("quiz-modal"),
    quizQuestion: document.getElementById("quiz-question"),
    quizOptions: document.getElementById("quiz-options"),
    quizFeedback: document.getElementById("quiz-feedback"),
    landing: document.getElementById("landing"),
    landingName: document.getElementById("landing-name"),
    landingCode: document.getElementById("landing-code"),
    landingCodeField: document.getElementById("landing-code-field"),
    landingRoom: document.getElementById("landing-room"),
    landingRoomCode: document.getElementById("landing-room-code"),
    landingStart: document.getElementById("landing-start"),
    playingAs: document.getElementById("playing-as"),
  };

  const Store = window.CalBingoStore;

  let state = null;   // { order: number[36], marked: boolean[36], names: string[36], quizzesSeen: number[] }
  let player = null;  // Store ref for the current player: { key, code, name, id }
  let sessionCode = "";    // room code from the QR/URL (#s=<code>), or "" for solo play
  let setupOk = true;      // false when there aren't enough prompts to build a card
  let hasWon = false;
  let activeCell = -1;
  let activeQuiz = null;    // the question currently being shown
  let activeQuizIndex = -1; // its index in QUIZ (so a wrong answer can recycle it)
  let quizAnswered = false;
  let quizThreshold = 0;    // which mark-count triggered the current quiz
  let quizMarkIndex = -1;   // the square just marked when the quiz fired
  let pendingSwap = null;   // { a, b } to run when the quiz closes (wrong answer)
  let quizTimer = null;
  let askedQuestions = [];  // question indices already shown (avoids repeats)

  /* ---- utilities --------------------------------------------------------- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showSetupError() {
    els.error.hidden = false;
    els.error.textContent =
      `Setup needed: found ${PROMPTS.length} prompt(s), but ${NEEDED_PROMPTS} ` +
      `are required. Edit js/prompts.js and add prompts until you have at least ` +
      `${NEEDED_PROMPTS}.`;
    els.board.hidden = true;
    if (els.newCard) els.newCard.hidden = true;
  }

  /* ---- state ------------------------------------------------------------- */

  function buildOrder() {
    // Pick 35 prompt indices at random, then splice in the FREE marker (-1).
    const picked = shuffle(PROMPTS.map((_, i) => i)).slice(0, NEEDED_PROMPTS);
    picked.splice(FREE_INDEX, 0, -1); // -1 flags the FREE cell
    return picked;
  }

  function freshState() {
    const marked = new Array(CELLS).fill(false);
    const names = new Array(CELLS).fill("");
    marked[FREE_INDEX] = true;
    return { order: buildOrder(), marked, names, quizzesSeen: [] };
  }

  /* ---- session code (URL) & sanitizing ----------------------------------- */

  // Room code from the QR / shared link: …/index.html#s=<code>.
  function sessionCodeFromUrl() {
    const m = /[#&]s=([^&]+)/.exec(window.location.hash || "");
    return m ? decodeURIComponent(m[1]).trim().toUpperCase() : "";
  }

  // Repair a card blob coming back from storage/cloud so render() is always safe.
  function sanitizeState(s) {
    if (!s || !Array.isArray(s.order) || s.order.length !== CELLS) return null;
    if (!Array.isArray(s.marked) || s.marked.length !== CELLS) return null;
    if (!Array.isArray(s.names) || s.names.length !== CELLS) s.names = new Array(CELLS).fill("");
    if (!Array.isArray(s.quizzesSeen)) s.quizzesSeen = [];
    s.marked[FREE_INDEX] = true; // FREE always marked
    return s;
  }

  // Persist through the Store (localStorage now, cloud debounced when in a
  // session). Meta lets the host leaderboard sort without parsing the card.
  function save() {
    if (!player) return;
    Store.savePlayer(player, state, { markCount: playerMarkCount(), hasWon: hasWon });
  }

  /* ---- win detection ----------------------------------------------------- */

  // Returns array of winning cell-indices (empty if none). Pass a marked array
  // to test a hypothetical board (e.g. the result of a swap); defaults to live.
  function findWin(marked) {
    const m = marked || state.marked;
    const lines = [];
    for (let r = 0; r < SIZE; r++) {
      lines.push(Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
    }
    for (let c = 0; c < SIZE; c++) {
      lines.push(Array.from({ length: SIZE }, (_, r) => r * SIZE + c));
    }
    lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + i));            // main diag
    lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i))); // anti diag

    for (const line of lines) {
      if (line.every((i) => m[i])) return line;
    }
    return [];
  }

  /* ---- rendering --------------------------------------------------------- */

  function textFor(cellIndex) {
    const p = state.order[cellIndex];
    return p === -1 ? FREE_LABEL : PROMPTS[p];
  }

  function render() {
    els.board.innerHTML = "";
    for (let i = 0; i < CELLS; i++) {
      const isFree = state.order[i] === -1;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = i;
      cell.setAttribute("aria-pressed", String(!!state.marked[i]));
      // diagonal wave (row + col) drives the staggered entrance delay
      cell.style.setProperty("--wave", Math.floor(i / SIZE) + (i % SIZE));
      if (isFree) cell.classList.add("cell--free");
      if (state.marked[i]) cell.classList.add("is-marked");

      const span = document.createElement("span");
      span.className = "cell__text";
      span.textContent = textFor(i);
      cell.appendChild(span);

      // Name badge: shown when a marked square has a recorded name.
      if (!isFree && state.marked[i] && state.names[i]) {
        const name = document.createElement("span");
        name.className = "cell__name";
        name.textContent = state.names[i];
        cell.appendChild(name);
      }
      els.board.appendChild(cell);
    }
  }

  function renderCell(i, animate) {
    // Re-render a single cell in place (after marking/naming).
    const old = els.board.querySelector(`.cell[data-index="${i}"]`);
    if (!old) return;
    const isFree = state.order[i] === -1;
    const cell = old.cloneNode(false);
    // `is-pop` triggers a one-shot bounce + ✓ pop when the player marks a square.
    const pop = animate && state.marked[i] ? " is-pop" : "";
    cell.className = "cell" + (isFree ? " cell--free" : "") + (state.marked[i] ? " is-marked" : "") + pop;
    cell.setAttribute("aria-pressed", String(!!state.marked[i]));
    const span = document.createElement("span");
    span.className = "cell__text";
    span.textContent = textFor(i);
    cell.appendChild(span);
    if (!isFree && state.marked[i] && state.names[i]) {
      const name = document.createElement("span");
      name.className = "cell__name";
      name.textContent = state.names[i];
      cell.appendChild(name);
    }
    old.replaceWith(cell);
  }

  function highlightWin(line) {
    line.forEach((i) => {
      const el = els.board.querySelector(`.cell[data-index="${i}"]`);
      if (el) el.classList.add("is-win");
    });
  }

  /* ---- interactions ------------------------------------------------------ */

  // Any square marked by the player (the FREE space doesn't count).
  function hasProgress() {
    return state.marked.some((m, i) => m && i !== FREE_INDEX);
  }

  // Squares the player has marked (excludes the FREE space).
  function playerMarkCount() {
    return state.marked.reduce((n, m, i) => n + (m && i !== FREE_INDEX ? 1 : 0), 0);
  }

  /* ---- mid-game checkpoint quiz ------------------------------------------ */

  // Fire a checkpoint after every QUIZ_INTERVAL marks (2, 4, 6, …) — but stop
  // once the player has won. quizzesSeen tracks which counts already fired so
  // un-marking and re-marking can't replay the same checkpoint.
  function maybeShowQuiz(justMarkedIndex) {
    if (!QUIZ.length || hasWon) return;        // feature off, or game already won
    const count = playerMarkCount();
    if (count > 0 && count % QUIZ_INTERVAL === 0 && !state.quizzesSeen.includes(count)) {
      showQuiz(count, justMarkedIndex);
    }
  }

  // Pick a question we haven't shown yet this game (reset once all are used).
  function pickQuestionIndex() {
    let pool = QUIZ.map((_, i) => i).filter((i) => !askedQuestions.includes(i));
    if (!pool.length) { askedQuestions = []; pool = QUIZ.map((_, i) => i); }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    askedQuestions.push(idx);
    return idx;
  }

  function showQuiz(threshold, markIndex) {
    quizThreshold = threshold;
    quizMarkIndex = markIndex;
    quizAnswered = false;
    pendingSwap = null;
    activeQuizIndex = pickQuestionIndex();
    activeQuiz = QUIZ[activeQuizIndex];

    els.quizQuestion.textContent = activeQuiz.q;
    els.quizOptions.innerHTML = "";
    (activeQuiz.options || []).forEach((opt, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn--ghost quiz__option";
      b.textContent = opt;
      b.addEventListener("click", () => answerQuiz(idx));
      els.quizOptions.appendChild(b);
    });
    els.quizFeedback.hidden = true;
    els.quizFeedback.textContent = "";
    els.quiz.hidden = false;
    const first = els.quizOptions.querySelector(".quiz__option");
    if (first) first.focus();
  }

  function answerQuiz(idx) {
    if (quizAnswered) return;
    quizAnswered = true;

    const opts = activeQuiz.options || [];
    const correct = activeQuiz.answer;
    const graded = Number.isInteger(correct) && correct >= 0 && correct < opts.length;
    const isWrong = graded && idx !== correct;

    els.quizOptions.querySelectorAll(".quiz__option").forEach((b, i) => {
      b.disabled = true;
      if (isWrong) {
        // Don't reveal the answer — only flag the wrong pick.
        if (i === idx) b.classList.add("is-wrong");
      } else if (graded && i === correct) {
        b.classList.add("is-correct");
      }
    });

    if (isWrong) {
      // Recycle this question so it can come back around at a later checkpoint.
      const pos = askedQuestions.indexOf(activeQuizIndex);
      if (pos !== -1) askedQuestions.splice(pos, 1);
      // Penalty — swap the just-marked square with a random other one, but never
      // one that would complete a line (no winning off a wrong answer).
      const partner = randomSwapPartner(quizMarkIndex);
      if (partner >= 0) {
        pendingSwap = { a: quizMarkIndex, b: partner };
        els.quizFeedback.textContent =
          "Oops, not quite! Two of your squares are swapping places…";
      } else {
        pendingSwap = null;   // no safe swap available — skip the penalty
        els.quizFeedback.textContent = "Oops, not quite!";
      }
    } else if (!graded) {
      els.quizFeedback.textContent = "Nice — now get back out there!";
    } else {
      els.quizFeedback.textContent = "🎉 Correct! You really do know Calvin.";
    }
    els.quizFeedback.hidden = false;

    // Let players read the feedback, then auto-advance (and run any swap).
    quizTimer = setTimeout(finishQuiz, QUIZ_FEEDBACK_MS);
  }

  function finishQuiz() {
    if (quizTimer) { clearTimeout(quizTimer); quizTimer = null; }
    if (!state.quizzesSeen.includes(quizThreshold)) state.quizzesSeen.push(quizThreshold);
    save();
    els.quiz.hidden = true;
    activeQuiz = null;

    const swap = pendingSwap;
    pendingSwap = null;
    if (swap) animateSwap(swap.a, swap.b, checkWin);
  }

  // Would swapping cells a and b complete a line? (Only positions a and b change
  // marked-state, so this catches every new win the swap could cause.)
  function swapCreatesWin(a, b) {
    const m = state.marked.slice();
    const t = m[a]; m[a] = m[b]; m[b] = t;
    return findWin(m).length > 0;
  }

  // A random swap partner that ISN'T the FREE space, the just-marked square, or
  // any cell whose swap would hand the player a bingo (a wrong answer must never
  // win the game). Returns -1 if no safe partner exists (then we skip the swap).
  function randomSwapPartner(exclude) {
    const safe = [];
    for (let i = 0; i < CELLS; i++) {
      if (i === FREE_INDEX || i === exclude) continue;
      if (!swapCreatesWin(exclude, i)) safe.push(i);
    }
    if (!safe.length) return -1;
    return safe[Math.floor(Math.random() * safe.length)];
  }

  /* ---- square swap (wrong-answer penalty) -------------------------------- */

  function cellEl(i) {
    return els.board.querySelector(`.cell[data-index="${i}"]`);
  }

  // Swap the contents (prompt, mark, name) of two board positions.
  function doSwap(a, b) {
    [state.order[a], state.order[b]] = [state.order[b], state.order[a]];
    [state.marked[a], state.marked[b]] = [state.marked[b], state.marked[a]];
    [state.names[a], state.names[b]] = [state.names[b], state.names[a]];
    save();
    renderCell(a);
    renderCell(b);
    updateNewCardState();
  }

  // Animate two cells flying past each other, then commit the swap. FLIP-style
  // with fixed-position clones so the CSS grid layout is never disturbed.
  function animateSwap(a, b, done) {
    const elA = cellEl(a), elB = cellEl(b);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!elA || !elB || reduce) {
      doSwap(a, b);
      if (done) done();
      return;
    }

    const rA = elA.getBoundingClientRect();
    const rB = elB.getBoundingClientRect();

    const ghost = (el, r) => {
      const g = el.cloneNode(true);
      g.classList.add("is-flying");
      g.classList.remove("is-win");
      Object.assign(g.style, {
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
      document.body.appendChild(g);
      return g;
    };
    const gA = ghost(elA, rA);
    const gB = ghost(elB, rB);

    // Hide the real cells while their clones do the flying.
    elA.style.visibility = "hidden";
    elB.style.visibility = "hidden";

    requestAnimationFrame(() => {
      gA.style.transform = `translate(${rB.left - rA.left}px, ${rB.top - rA.top}px)`;
      gB.style.transform = `translate(${rA.left - rB.left}px, ${rA.top - rB.top}px)`;
    });

    setTimeout(() => {
      gA.remove();
      gB.remove();
      // doSwap re-renders both cells with the swapped content. renderCell clones
      // the old node (style attribute included), so clear the visibility:hidden
      // we set above off the fresh nodes.
      doSwap(a, b);
      const na = cellEl(a), nb = cellEl(b);
      if (na) na.style.visibility = "";
      if (nb) nb.style.visibility = "";
      if (done) done();
    }, SWAP_MS + 40);
  }

  // Lock "Start a new card" once play has begun so progress can't be wiped.
  function updateNewCardState() {
    if (!els.newCard) return;
    const locked = hasProgress();
    els.newCard.disabled = locked;
    els.newCard.title = locked
      ? "You've started marking squares — a new card is locked to protect your progress."
      : "";
  }

  // Set a square's mark + name, refresh the cell, re-check win, then persist.
  function setCell(index, marked, name) {
    if (state.order[index] === -1) return; // FREE is locked
    state.marked[index] = marked;
    state.names[index] = marked ? (name || "") : "";
    renderCell(index, marked);   // animate the pop only when marking
    updateNewCardState();
    checkWin();                  // flips hasWon BEFORE we save, so the leaderboard's
    save();                      // has_won / mark_count are current for this move
    // Wait for the square's mark animation to land before a checkpoint pops up,
    // so the player sees the ✓ pop first (immediate when motion is reduced).
    if (marked) {
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => maybeShowQuiz(index), reduce ? 0 : MARK_POP_MS);
    }
  }

  // Reveal the full-screen finale: BINGO stamp -> camera flash -> selfie challenge.
  // Toggling `hidden` re-renders the element, which replays its CSS reveal
  // animations if the finale is shown again after being dismissed.
  function showFinale() {
    if (!els.finale) return;
    els.finale.hidden = false;
    if (window.CalBingoConfetti) {
      window.CalBingoConfetti.fire();
      // second burst synced to the "camera flash" as the card rises in
      setTimeout(() => {
        if (hasWon && window.CalBingoConfetti) window.CalBingoConfetti.fire();
      }, 1000);
    }
  }

  function hideFinale() {
    if (els.finale) els.finale.hidden = true;
  }

  function checkWin() {
    const line = findWin();
    if (line.length && !hasWon) {
      hasWon = true;
      highlightWin(line);
      showFinale();
    } else if (!line.length) {
      hasWon = false;
      hideFinale();
      els.board.querySelectorAll(".is-win").forEach((el) => el.classList.remove("is-win"));
    }
  }

  function openModal(index) {
    if (state.order[index] === -1) return; // FREE has nothing to fill in
    activeCell = index;
    els.modalText.textContent = textFor(index);
    els.modalInput.value = state.names[index] || "";
    els.modalSave.textContent = state.marked[index] ? "Save" : "Mark it";
    els.modalUnmark.hidden = !state.marked[index];
    els.modal.hidden = false;
    els.modalInput.focus();
  }

  function closeModal() {
    els.modal.hidden = true;
    activeCell = -1;
  }

  function saveFromModal() {
    if (activeCell < 0) return;
    setCell(activeCell, true, els.modalInput.value.trim());
    closeModal();
  }

  function wireEvents() {
    // Tap anywhere on a square to open it and record who you found.
    els.board.addEventListener("click", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell) return;
      openModal(Number(cell.dataset.index));
    });

    if (els.newCard) {
      els.newCard.addEventListener("click", () => {
        if (hasProgress()) return; // locked once play has begun
        if (confirm("Start a brand-new card? This clears your marks and names.")) {
          // Reshuffle in place — same player (name + room), so it overwrites this
          // player's saved card rather than leaving an orphan behind.
          state = freshState();
          hasWon = false;
          save();
          render();
          updateNewCardState();
          checkWin();
          playBoardEntrance();
        }
      });
    }

    if (els.finaleDone) els.finaleDone.addEventListener("click", hideFinale);
    if (els.finaleClose) els.finaleClose.addEventListener("click", hideFinale);
    if (els.finale) els.finale.addEventListener("click", (e) => {
      if (e.target === els.finale) hideFinale(); // tap the backdrop to dismiss
    });

    if (els.modalSave) els.modalSave.addEventListener("click", saveFromModal);
    if (els.modalInput) els.modalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveFromModal(); }
    });
    if (els.modalUnmark) els.modalUnmark.addEventListener("click", () => {
      if (activeCell >= 0) setCell(activeCell, false);
      closeModal();
    });
    if (els.modalClose) els.modalClose.addEventListener("click", closeModal);
    if (els.modal) els.modal.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!els.modal.hidden) closeModal();
      else if (els.finale && !els.finale.hidden) hideFinale();
    });
  }

  /* ---- landing / player name --------------------------------------------- */

  function loadUsername() {
    try { return localStorage.getItem(USER_KEY) || ""; } catch (e) { return ""; }
  }

  function saveUsername(name) {
    try { localStorage.setItem(USER_KEY, name); } catch (e) { /* storage may be off */ }
  }

  // "Playing as <name>" (+ "· Room <code>") under the header, once past the landing.
  function updatePlayingAs() {
    if (!els.playingAs) return;
    const name = loadUsername();
    if (!name) { els.playingAs.hidden = true; return; }
    els.playingAs.textContent = "";
    els.playingAs.append("Playing as ");
    const strong = document.createElement("strong");
    strong.textContent = name;
    els.playingAs.append(strong);
    if (player && player.code) {
      els.playingAs.append(" · Room ");
      const room = document.createElement("strong");
      room.textContent = player.code;
      els.playingAs.append(room);
    }
    els.playingAs.hidden = false;
  }

  // Reflect the room in the landing: a read-only chip when the code came from the
  // QR/URL, an optional input when a backend is set up, or nothing for solo play.
  function setupLandingCode() {
    const showChip = !!sessionCode;
    const showField = !sessionCode && Store.hasBackend;
    if (els.landingRoom) els.landingRoom.hidden = !showChip;
    if (showChip && els.landingRoomCode) els.landingRoomCode.textContent = sessionCode;
    if (els.landingCodeField) els.landingCodeField.hidden = !showField;
  }

  async function startFromLanding() {
    const name = (els.landingName.value || "").trim();
    if (!name) { els.landingName.focus(); return; }  // name required to start

    // Not enough prompts to build a card — just reveal the setup message behind.
    if (!setupOk) { if (els.landing) els.landing.hidden = true; return; }

    // Room code: from the URL, else the optional field (blank = solo local play).
    const code = sessionCode ||
      (els.landingCode ? els.landingCode.value.trim().toUpperCase() : "");

    saveUsername(name);
    if (els.landingStart) { els.landingStart.disabled = true; els.landingStart.textContent = "Joining…"; }

    let resolved;
    try {
      resolved = await Store.resolvePlayer({ code: code, name: name, fresh: freshState() });
    } catch (e) {
      // Store falls back internally, so this is belt-and-suspenders — never trap
      // the player on a fresh local card.
      resolved = { ref: { key: "", code: code, name: name, id: null }, state: freshState() };
    }

    player = resolved.ref;
    state = sanitizeState(resolved.state) || freshState();
    hasWon = false;

    if (els.landingStart) { els.landingStart.disabled = false; els.landingStart.textContent = "Start playing"; }
    if (els.landing) els.landing.hidden = true;
    updatePlayingAs();

    render();
    updateNewCardState();
    checkWin();            // a resumed, already-won card replays its finale
    playBoardEntrance();
  }

  // Staggered "deal in" of the board cells. Gated by a board class so it only
  // runs when we ask (on reveal / new card), not on every re-render. Removed
  // after the last cell lands so it never fights the mark/win animations.
  let entranceTimer = null;
  function playBoardEntrance() {
    if (!els.board) return;
    els.board.classList.remove("is-entering");
    // force reflow so re-adding the class restarts the animation
    void els.board.offsetWidth;
    els.board.classList.add("is-entering");
    if (entranceTimer) clearTimeout(entranceTimer);
    entranceTimer = setTimeout(() => els.board.classList.remove("is-entering"), 1100);
  }

  // Landing is visible by default (shown every visit). The name is pre-filled
  // with the last one used so a returning player resumes with one tap.
  function wireLanding() {
    if (!els.landing) return;
    setupLandingCode();
    if (els.landingName) {
      els.landingName.value = loadUsername();
      const sync = () => {
        if (els.landingStart) els.landingStart.disabled = !els.landingName.value.trim();
      };
      sync();
      els.landingName.addEventListener("input", sync);
      els.landingName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); startFromLanding(); }
      });
      els.landingName.focus();
    }
    if (els.landingCode) {
      els.landingCode.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); startFromLanding(); }
      });
    }
    if (els.landingStart) els.landingStart.addEventListener("click", startFromLanding);
  }

  /* ---- boot -------------------------------------------------------------- */

  // The board is dealt only after the player passes the name/room landing
  // (startFromLanding), so a fresh scan always starts a new card unless the
  // player resumes by joining the same room with the same name.
  function init() {
    sessionCode = sessionCodeFromUrl();
    wireLanding();
    wireEvents();
    if (PROMPTS.length < NEEDED_PROMPTS) { setupOk = false; showSetupError(); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
