/* ============================================================================
 * CalBingo — backend config (optional)
 *
 * Leave this blank and the game runs exactly as before: one card per device,
 * saved to localStorage, no accounts, no server. Fully offline-capable.
 *
 * Fill it in to turn on host-run SESSIONS with a LIVE LEADERBOARD (see host.html)
 * and durable, cross-device saves — powered by Supabase's free tier.
 *
 *   1. Create a free project at https://supabase.com
 *   2. Run supabase/schema.sql in the project's SQL editor
 *   3. Project Settings → API → copy the Project URL and the "anon public" key
 *      into the two fields below.
 *
 * The anon key is SAFE to publish in this page — that's what it's designed for.
 * Access is governed by the Row-Level Security policies in schema.sql.
 * ==========================================================================*/
window.CALBINGO_SUPABASE = {
  url: "https://miwkkaryrtakqkjpalfm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd2trYXJ5cnRha3FranBhbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjQ1NzUsImV4cCI6MjEwMDQwMDU3NX0.5FB9Mx7GRdwjI3klSE5OPd1e6W-KLKKYjwJd6KjE638",
};
