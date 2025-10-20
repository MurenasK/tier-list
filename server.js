import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// --- Setup Paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "runners.db");

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Environment variables
const ADMIN_PASSWORD = process.env.PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// --- Middleware ---
app.use(express.json());
app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// --- Database ---
// NOTE: On an ephemeral filesystem (like Render Web Service), this file will be lost on restart.
// For persistence, you MUST switch to an external database (PostgreSQL) or use a persistent Disk on Render.
const db = new Database(DB_PATH);

// --- Tables ---
// Using db.transaction ensures all table creations either succeed or fail together
db.transaction(() => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS runners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lastActiveDate TEXT DEFAULT (datetime('now')),
      rank INTEGER,
      rating INTEGER DEFAULT 1000
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS competitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT,
      difficulty TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS competition_runners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      runner_id INTEGER NOT NULL,
      time REAL DEFAULT 0,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
      FOREIGN KEY (runner_id) REFERENCES runners(id) ON DELETE CASCADE,
      UNIQUE (competition_id, runner_id)
    )
  `).run();
})(); // Immediately invoke the transaction

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!ADMIN_PASSWORD) {
    console.error("❌ Backend PASSWORD environment variable not set!");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  // Clients must send the password as the entire Authorization header value
  if (auth === ADMIN_PASSWORD) next();
  else res.status(403).json({ error: "Forbidden" });
};

// --- Routes ---

// Get all runners (public)
app.get("/api/runners", (req, res) => {
  try {
    const runners = db.prepare("SELECT * FROM runners ORDER BY rating DESC, name ASC").all();
    res.json(runners);
  } catch (err) {
    console.error("Error getting runners:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add runner (admin)
app.post("/api/runners", authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: "Valid name is required" });
  }
  try {
    const info = db.prepare("INSERT INTO runners (name) VALUES (?)").run(name.trim());
    res.status(201).json({ message: "Runner added!", id: info.lastInsertRowid });
  } catch (err) {
    console.error("Error adding runner:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update runner rating (ELO)
app.patch("/api/runners/:id/elo", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  
  if (rating == null || isNaN(rating) || !isFinite(rating)) {
    return res.status(400).json({ error: "A valid numerical rating is required" });
  }
  
  try {
    const info = db.prepare("UPDATE runners SET rating = ? WHERE id = ?").run(rating, id);
    if (info.changes === 0) {
        return res.status(404).json({ message: `Runner ${id} not found` });
    }
    res.json({ message: `Runner ${id} rating updated` });
  } catch (err) {
    console.error("Error updating rating:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete runner
app.delete("/api/runners/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    const info = db.prepare("DELETE FROM runners WHERE id = ?").run(id);
    if (info.changes === 0) {
        return res.status(404).json({ message: `Runner ${id} not found` });
    }
    // Deleting from runners will CASCADE delete competition_runners due to ON DELETE CASCADE
    res.json({ message: `Runner ${id} deleted` });
  } catch (err) {
    console.error("Error deleting runner:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add competition
app.post("/api/competitions", authMiddleware, (req, res) => {
  const { name, date, difficulty } = req.body;
  if (!name) return res.status(400).json({ error: "Competition name is required" });

  try {
    const info = db.prepare("INSERT INTO competitions (name, date, difficulty) VALUES (?, ?, ?)").run(name, date, difficulty);
    res.status(201).json({ message: "Competition added!", id: info.lastInsertRowid });
  } catch (err) {
    console.error("Error adding competition:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add runners to a competition
app.post("/api/competitions/:id/runners", authMiddleware, (req, res) => {
  const { id: competition_id } = req.params;
  const { runners } = req.body; // [{ id: runnerId, time: 123 }, ...]
  
  if (!Array.isArray(runners) || runners.length === 0) {
    return res.status(400).json({ error: "runners must be a non-empty array of objects" });
  }
  
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO competition_runners (competition_id, runner_id, time)
      VALUES (?, ?, ?)
    `);

    // Use a transaction for multiple inserts (much faster)
    const insertMany = db.transaction((runners) => {
      for (const r of runners) {
        const runnerId = parseInt(r.id);
        const time = parseFloat(r.time) || 0;
        if (isNaN(runnerId)) continue; // Skip bad runner IDs
        stmt.run(competition_id, runnerId, time);
      }
    });

    insertMany(runners);

    res.json({ message: "Runners added to competition" });
  } catch (err) {
    console.error("Error adding runners to competition:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all competitions with participants
app.get("/api/competitions", (req, res) => {
  try {
    const competitions = db.prepare("SELECT * FROM competitions ORDER BY date DESC, id DESC").all();
    
    // Prepare statement for reuse
    const participantsStmt = db.prepare(`
        SELECT 
          r.id, 
          r.name, 
          r.rating,
          cr.time
        FROM competition_runners cr
        JOIN runners r ON r.id = cr.runner_id
        WHERE cr.competition_id = ?
        ORDER BY cr.time ASC -- Order by time for competition results
    `);

    const competitionsWithParticipants = competitions.map((comp) => {
      const participants = participantsStmt.all(comp.id);
      return { ...comp, participants };
    });

    res.json(competitionsWithParticipants);
  } catch (err) {
    console.error("Error getting competitions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Static Frontend Serving ---

// Serve React frontend (Ensure 'dist' directory exists in your project root)
app.use(express.static(path.join(__dirname, "dist")));

// Handle client-side routing by serving index.html for all non-API requests
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn("⚠️ WARNING: The 'PASSWORD' environment variable is not set. All admin routes will fail.");
  }
});