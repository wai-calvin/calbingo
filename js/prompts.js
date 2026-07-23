/* ============================================================================
 * CalBingo — PROMPTS
 * ----------------------------------------------------------------------------
 * This is the ONE file you edit to make the game yours.
 *
 * RULES:
 *   • You need at least 35 prompts (the 36th square is the FREE space). This
 *     set has ~45, so each player's card randomly draws 35 — extra prompts add
 *     variety between cards.
 *   • Keep each prompt short-ish — long ones still work (tap a square to read
 *     the full text) but shorter reads better on a phone.
 *   • Write them as "Someone who ..." so guests go find a real person who
 *     matches.
 *
 * This set is grouped FAMILY / FRIENDS / ABOUT YOU for a mixed friends-and-
 * family crowd, and skews challenging on purpose. The grouping is just for you
 * — the game ignores it and draws 35 at random from the whole list. Swap in
 * real specifics (weddings, trips, jobs) wherever you can to make it personal.
 * ==========================================================================*/

const FREE_LABEL = "FREE";

const PROMPTS = [
  // ---- FAMILY: knew Calvin growing up / related / knows his family --------
  "Someone who was there when Calvin was born",
  "Someone who knew Calvin before he could walk",
  "Someone who knew Calvin before he turned 10",
  "Someone who has been to Calvin's childhood home",
  "Someone who has met Calvin's mom",
  "Someone who is related to Calvin by blood",
  "Someone who shares a last name with Calvin",
  "Someone who knows Calvin's middle name",
  "Someone who knows Calvin's childhood nickname",
  "Someone who knows Calvin's hometown",
  "Someone who has seen Calvin's baby photos",
  "Someone who has met Calvin's grandparents",
  "Someone who can name all of Calvin's siblings",
  "Someone who knows Calvin's parents' first names",
  "Someone who spent childhood holidays with Calvin",
  "Someone who has been to a family reunion with Calvin",
  "Someone who has a childhood photo with Calvin",
  "Someone who has eaten a home-cooked meal at Calvin's",
  "Someone who knows a family tradition of Calvin's",
  "Someone who taught Calvin something as a kid",

  // ---- FRIENDS: the crew, from school to last week ------------------------
  "Someone Calvin went to school with",
  "Someone who has known Calvin for 20+ years",
  "Someone who met Calvin in the last year",
  "Someone who first met Calvin today",
  "Someone who has worked with Calvin",
  "Someone who has been Calvin's roommate",
  "Someone who has traveled with Calvin",
  "Someone who has gone on a road trip with Calvin",
  "Someone who has been to a concert with Calvin",
  "Someone who has been on a team with Calvin",
  "Someone who has an inside joke with Calvin",
  "Someone who has a nickname Calvin gave them",
  "Someone who has lost a bet to Calvin",
  "Someone who has stayed out past 2am with Calvin",
  "Someone who has beaten Calvin at a video game",
  "Someone who has seen Calvin cry at a movie",
  "Someone who can name Calvin's favorite band",
  "Someone who knows Calvin's coffee order",
  "Someone who can do a Calvin impression",
  "Someone who knows a secret talent of Calvin's",

  // ---- ABOUT YOU: find someone who matches the player (not Calvin) --------
  "Someone born in the same month as you",
  "Someone wearing the same color as you",
  "Someone who shares your first initial",
  "Someone with the same favorite season as you",
  "Someone who has the same number of siblings as you",
];

/* ----------------------------------------------------------------------------
 * MID-GAME CHECKPOINT (optional)
 * After a guest marks their 3rd square, ONE of these pops up and must be
 * answered before they can keep playing — a fun "do you really know Calvin?"
 * interruption. Edit freely:
 *   • q       — the question
 *   • options — the choices (2–4 read best on a phone)
 *   • answer  — 0-based index of the correct option (0 = first). Omit it and
 *               any answer is accepted (handy for opinion questions).
 * Set QUIZ = [] to turn the checkpoint off entirely.
 * -------------------------------------------------------------------------- */
const QUIZ = [
  { q: "How does Calvin take his coffee?",
    options: ["Black, no nonsense", "Oat-milk latte", "So sweet it's basically dessert"], answer: 1 },
  { q: "What's Calvin's go-to karaoke song?",
    options: ["Mr. Brightside", "Bohemian Rhapsody", "Don't Stop Believin'"], answer: 0 },
  { q: "Which is Calvin most likely to say?",
    options: ["\"Let me check the data.\"", "\"One more round!\"", "\"I'll fix it in prod.\""], answer: 2 },
  { q: "Calvin's ideal weekend is…",
    options: ["A big trip somewhere new", "Couch, snacks, and a series", "Out with the whole crew"], answer: 0 },
  { q: "Pick Calvin's hidden talent:",
    options: ["Perfect parallel parking", "Naming any song in 3 notes", "Winning every board game"], answer: 1 },
  { q: "What's Calvin most likely to be late for?",
    options: ["A morning meeting", "A flight", "His own party"], answer: 0 },
  { q: "Calvin's dream vacation is…",
    options: ["A beach with zero plans", "Backpacking somewhere new", "A big-city food tour"], answer: 1 },
  { q: "Which emoji does Calvin overuse?",
    options: ["😂", "🙏", "🔥"], answer: 0 },
  { q: "Calvin's guilty-pleasure snack?",
    options: ["Spicy chips", "Gummy bears", "Cold pizza"], answer: 2 },
  { q: "What would Calvin grab first in a fire?",
    options: ["His laptop", "His pet", "His sneaker collection"], answer: 1 },
];

// Expose to the page (works whether loaded as a module or plain script tag).
window.CALBINGO_PROMPTS = PROMPTS;
window.CALBINGO_FREE_LABEL = FREE_LABEL;
window.CALBINGO_QUIZ = QUIZ;
