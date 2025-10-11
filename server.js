import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// --- Database ---
const db = new Database("runners.db");

// Create runners table (no photo column)
db.prepare(`
  CREATE TABLE IF NOT EXISTS runners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rank INTEGER,
    rating INTEGER DEFAULT 1000
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    difficulty INTEGER
  )
`).run();

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  const PASSWORD = "NiggasInParis";
  if (auth === PASSWORD) next();
  else res.status(403).json({ error: "Forbidden" });
};

// --- Routes ---

// Get all runners
app.get("/api/runners", (req, res) => {
  const runners = db.prepare("SELECT * FROM runners").all();
  // Map elo → rating
  const mapped = runners.map(r => ({
    id: r.id,
    name: r.name,
    team: r.team ?? null,
    rating: r.rating ?? 1000,     // alias elo -> rating
    photo_url: r.photo || null,
    quote: r.quote ?? null,
    photo: r.photo ?? null
  }));
  res.json(mapped);
});


// Add runner
app.post("/api/runners", authMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    db.prepare("INSERT INTO runners (name) VALUES (?)").run(name);
    res.json({ message: "Runner added!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete runner
app.delete("/api/runners/:id", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM runners WHERE id = ?").run(id);
    res.json({ message: `Runner ${id} deleted` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update runner rank (PATCH)
app.patch("/api/runners/:id/rank", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { rank } = req.body;

    if (rank === undefined) {
      return res.status(400).json({ error: "Rank is required" });
    }

    db.prepare("UPDATE runners SET rank = ? WHERE id = ?").run(rank, id);
    res.json({ message: `Runner ${id} rating updated (PATCH)` });
    console.log(`Runner ${id} rank updated to ${rating}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update runner ELO
app.patch("/api/runners/:id/elo", authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { elo } = req.body;

    if (elo === undefined) {
      return res.status(400).json({ error: "ELO is required" });
    }

    db.prepare("UPDATE runners SET rating = ? WHERE id = ?").run(elo, id);
    res.json({ message: `Runner ${id} ELO updated` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Competitions
app.post("/api/competitions", authMiddleware, (req, res) => {
  try {
    const { name, date, difficulty } = req.body;
    db.prepare("INSERT INTO competitions (name, date, difficulty) VALUES (?, ?, ?)").run(name, date, difficulty);
    res.json({ message: "Competition added!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/competitions", (req, res) => {
  const competitions = db.prepare("SELECT * FROM competitions").all();
  res.json(competitions);
});

// Update runner rating (elo)
app.patch("/api/runners/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  if (rating == null) return res.status(400).json({ error: "Rating is required" });
  db.prepare("UPDATE runners SET rating = ? WHERE id = ?").run(rating, id);
  res.json({ message: `Runner ${id} rating updated` });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

