# CalBingo 🎉

A browser-based **human bingo** game for a party. Guests scan one QR code on
their phones, each gets their own randomized **6×6 bingo card** of prompts about
Calvin's life (e.g. *"Someone who was there when Calvin was born"*), and they
mingle to find real people who match each square. Fill any full line to win.

- **No app to install** — it's just a web page.
- **Works with no backend** — out of the box every phone generates and saves its
  own card locally. Free to host, works offline.
- **Optional live sessions** — add free Supabase keys and you get host-run rooms
  with a **live leaderboard** and durable, cross-device saves. See
  [§5](#5-optional-live-sessions--leaderboard-supabase). Everything degrades
  gracefully back to local-only if it's unconfigured or offline.
- **One QR code** for everyone.

## 1. Make it yours (the only file you need to edit)

Open [`js/prompts.js`](js/prompts.js) and replace the list with your own
prompts. You need **at least 35** (the 36th square is a free space). More than
35 is great — each card randomly draws 35, so extra prompts add variety between
players' cards. If you have fewer than 35, the page shows a friendly setup
message instead of a card.

The same file also holds a `QUIZ` list — the **mid-game checkpoints**. After
**every 2 squares** a player marks (2nd, 4th, 6th, …, until they win), a random
question pops up and *must* be answered before they can keep playing. Get it
**right** and you carry on; get it **wrong** and the square you just marked
**swaps places with a random other square** (with a little fly-across animation)
— a playful penalty that scrambles the line you were building. The swap never
lands you a bingo — squares that would complete a line are excluded. A wrong answer
**doesn't reveal the correct option** and the question is **recycled** back into
the pool, so it may come around again at a later checkpoint. Edit the questions,
set `answer` to the 0-based index of the correct option, or set `QUIZ = []` to
switch the checkpoints off.

## 2. Try it locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/index.html> on your computer, or
`http://<your-computer-ip>:8000/index.html` on a phone on the same Wi-Fi.

- On every visit you land on a **name screen**: enter your name and you'll see
  the house rule — *you can't use yourself to fill a square* (honor system). Your
  name is remembered per device and shown as "Playing as …" under the header.
- Tap a square to read the full prompt and type **who you found** — saving
  marks the square (turns teal with a ✓) and shows their name.
- Tap a marked square again to edit the name or **Un-mark** it.
- Progress (marks + names) is saved automatically — refreshing keeps your card.
- **Start a new card** reshuffles the board — but only *before* you've marked
  anything. Once you mark your first square it locks, so progress can't be wiped.

### Sessions & fresh cards

Players are identified by their **name + a room code**. The room code rides in
the QR link (`…/index.html#s=CODE`), so scanning fills it in automatically; a
player can also type it on the landing screen to rejoin.

- **A new name deals a brand-new card.** First time in a room, you get a fresh
  random board — hand the same QR around and everyone gets their own.
- **The same name + room resumes your card.** Come back (even on another phone,
  when a backend is configured) and you pick up exactly where you left off —
  marks, names, and all. Your name is pre-filled so it's usually one tap.
- **"Start a new card"** reshuffles your board and is locked once you've marked a
  square, so progress can't be wiped by accident.

Without a backend this all works per-device via `localStorage`; with Supabase
keys added ([§5](#5-optional-live-sessions--leaderboard-supabase)) the same card
is saved to the cloud and resumes across devices. Either way the game caches
itself for offline use — a hard refresh picks up newly deployed changes.

## 3. Deploy (pick one — all free)

The whole thing is static files, so any static host works:

- **Netlify Drop** — drag this folder onto <https://app.netlify.com/drop>.
- **Vercel** — `npx vercel` in this folder.
- **GitHub Pages** — push to a repo, enable Pages on the branch root.

## 4. Host the room (the QR screen)

Open **`host.html`** on your deployed site (e.g.
`https://your-site.example/host.html`) and project or print it.

- **With Supabase configured** (§5): press **Start a session**. You get a short
  **room code** + QR pointing at `index.html#s=CODE`, and a **live leaderboard**
  that fills in as guests join and mark squares — winners rise to the top with a
  🏆. The active room is remembered across refreshes; **Start a new session**
  resets it.
- **Without a backend**: it shows the classic single QR pointing at the
  `index.html` next to it (every scan deals a fresh local card). Paste your live
  URL and press **Set** if you want to be certain of the address.

## 5. Optional: live sessions & leaderboard (Supabase)

This turns on host-run rooms, a real-time leaderboard, and cross-device saves.
It's all optional — skip it and the game runs exactly as described above.

1. Create a free project at <https://supabase.com>.
2. In the dashboard: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   `sessions` + `players` tables, turns on realtime, and sets the access rules.
3. **Project Settings → API**: copy the **Project URL** and the **`anon` public**
   key into [`js/config.js`](js/config.js).
4. Redeploy (bump `CACHE_VERSION` in `sw.js` so returning devices refresh).

That's it — `host.html` now offers **Start a session**, and players who scan the
room QR are saved to the cloud and appear on your leaderboard.

**Is the `anon` key safe to publish?** Yes — that's its purpose. Access is
limited by the Row-Level Security policies in `schema.sql`, which only expose the
two game tables. This is an honor-system party game with non-sensitive data
(names + which squares got marked), so those policies let the anonymous public
key read/write those two tables and nothing else in your project.

**Cost:** a party fits comfortably in the free tier (a few hundred rows and a
handful of realtime connections).

## Files

| File | What it is |
|------|-----------|
| `index.html` | The player's bingo card (the QR target) |
| `host.html` | Session console — room QR + live leaderboard (or a plain QR without a backend) |
| `js/prompts.js` | **Your prompts** — edit this |
| `js/bingo.js` | Card generation, marking, win detection, session/landing flow |
| `js/store.js` | Persistence seam — localStorage + optional Supabase, with graceful fallback |
| `js/config.js` | **Optional** Supabase URL + anon key (blank = local-only) |
| `supabase/schema.sql` | Run once in Supabase to create the tables + access rules |
| `js/confetti.js` | The little celebration burst |
| `css/style.css` | Styling ("confetti carnival" theme) |
| `css/fonts.css` + `fonts/` | Self-hosted Fraunces + DM Sans (no Google Fonts call) |
| `vendor/qrcode.min.js` | QR code generator (MIT, offline, no tracking) |
| `vendor/supabase.min.js` | Supabase JS client (only used when `config.js` is filled in) |
| `sw.js` | Service worker — caches the game so it works offline |
| `manifest.json` + `icon.svg` | Lets guests "Add to Home Screen" as an app |

## Works on any connection (or none)

In local-only mode the game makes **zero external network requests** — fonts,
scripts, styles, and the QR generator are all served from this folder. It loads
fine over Wi-Fi or cellular, and a guest only needs a connection the *first* time
they open the link.

After that first load, a **service worker** (`sw.js`) caches everything, so the
game keeps working if their signal drops — they can even refresh or reopen the
tab offline. Progress is stored on the phone, so nothing is lost.

With Supabase configured, saves also sync to the cloud — but the local cache
still comes first, so **marking a square never waits on the network** and a
dropped signal mid-game just reconciles when it comes back.

> Editing a cached file? Bump `CACHE_VERSION` at the top of `sw.js` so returning
> players pick up the change instead of the old cached copy.

## How winning works

A win is any full **row, column, or diagonal** (6 squares). The FREE space
(center-ish, gold star) counts as already marked and sits on the main diagonal.
Wins are on the honor system — perfect for calling out "BINGO!" across the room
and finding Calvin to verify. With a session running, the winner also pops to the
top of the host's leaderboard with a 🏆.

When a line fills, a full-screen **finale** takes over: "BINGO!" stamps in, a
camera-flash sweeps, and one last challenge appears — **take a selfie with
Calvin!** — the fun way to make a winner go find the birthday star in person.
Dismiss it with "Keep playing" (or Esc) to continue marking squares.
