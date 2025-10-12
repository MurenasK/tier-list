import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// --- Database ---
const db = new Database("runners.db");

// --- Tables ---

// Runners table
db.prepare(`
  CREATE TABLE IF NOT EXISTS runners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lastActiveDate TEXT DEFAULT (datetime('now')),
    rank INTEGER,
    rating INTEGER DEFAULT 1000
  )
`).run();

// Competitions table
db.prepare(`
  CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    difficulty TEXT
  )
`).run();

// Competition participants table
db.prepare(`
  CREATE TABLE IF NOT EXISTS competition_runners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    runner_id INTEGER NOT NULL,
    time REAL DEFAULT 0,
    FOREIGN KEY (competition_id) REFERENCES competitions(id),
    FOREIGN KEY (runner_id) REFERENCES runners(id),
    UNIQUE (competition_id, runner_id)
  )
`).run();

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  const PASSWORD = "NiggasInParis"; // change this
  if (auth === PASSWORD) next();
  else res.status(403).json({ error: "Forbidden" });
};

// --- Routes ---

// Get all runners
app.get("/api/runners", (req, res) => {
  const runners = db.prepare("SELECT * FROM runners").all();
  res.json(runners);
});

// Add runner
app.post("/api/runners", authMiddleware, (req, res) => {
  const { name } = req.body;
  const info = db.prepare("INSERT INTO runners (name) VALUES (?)").run(name);
  res.json({ message: "Runner added!", id: info.lastInsertRowid });
});

// Update runner rating (ELO)
app.patch("/api/runners/:id/elo", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  if (rating == null) return res.status(400).json({ error: "Rating is required" });
  db.prepare("UPDATE runners SET rating = ? WHERE id = ?").run(rating, id);
  res.json({ message: `Runner ${id} Rating updated` });
});

// Updates runner time
const updateDateStmt = db.prepare(`
  UPDATE runners SET lastActiveDate = datetime('now') WHERE id = ?
`);

const insertMany = db.transaction((runners) => {
  for (const r of runners) {
    stmt.run(competition_id, r.id, r.time || 0);
    updateDateStmt.run(r.id); // mark runner as active
  }
});

// --- Competitions ---

// Add competition
app.post("/api/competitions", authMiddleware, (req, res) => {
  const { name, date, difficulty } = req.body;
  const info = db.prepare("INSERT INTO competitions (name, date, difficulty) VALUES (?, ?, ?)").run(name, date, difficulty);
  res.json({ message: "Competition added!", id: info.lastInsertRowid });
});

// Add runners to a competition with times
app.post("/api/competitions/:id/runners", authMiddleware, (req, res) => {
  try {
    const { id: competition_id } = req.params;
    const { runners } = req.body; // [{ id: runnerId, time: 123 }, ...]

    if (!Array.isArray(runners)) return res.status(400).json({ error: "runners must be an array" });

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO competition_runners (competition_id, runner_id, time)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((runners) => {
      for (const r of runners) stmt.run(competition_id, r.id, r.time || 0);
    });

    insertMany(runners);

    res.json({ message: "Runners added to competition" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all competitions with participants
app.get("/api/competitions", (req, res) => {
  try {
    const competitions = db.prepare("SELECT * FROM competitions").all();

    const competitionsWithParticipants = competitions.map((comp) => {
      const participants = db.prepare(`
        SELECT r.id, r.name, cr.time
        FROM competition_runners cr
        JOIN runners r ON r.id = cr.runner_id
        WHERE cr.competition_id = ?
      `).all(comp.id);

      return { ...comp, participants };
    });

    res.json(competitionsWithParticipants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
