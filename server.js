import express from "express";
import cors from "cors";
import pg from "pg"; // ⬅️ NEW: PostgreSQL Client
import path from "path";
import { fileURLToPath } from "url";

// --- Setup Paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Environment variables
const ADMIN_PASSWORD = process.env.PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// ⬅️ NEW: Database URL from Render environment variables
const DATABASE_URL = process.env.DATABASE_URL;

// --- Database Connection Pool ---
// Use the provided database URL for the connection
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set!");
    process.exit(1); // Exit if no database connection string is available
}

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    // Optional: Add SSL configuration if your Render database requires it (often needed for external connections)
    // ssl: {
    //     rejectUnauthorized: false // Use this if Render requires strict SSL but you don't have a ca file
    // }
});

// Utility function to execute a query (handles connection/release)
const runQuery = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result;
    } finally {
        client.release();
    }
};

// --- Database Schema Initialization (Asynchronous) ---
const setupDatabase = async () => {
    try {
        // Runner Table (Use SERIAL for auto-increment, TIMESTAMP WITH TIME ZONE for dates)
        await runQuery(`
            CREATE TABLE IF NOT EXISTS runners (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                lastActiveDate TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                rank INTEGER,
                rating INTEGER DEFAULT 1000
            )
        `);

        // Competitions Table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS competitions (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT,
                difficulty TEXT
            )
        `);

        // Competition Runners Table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS competition_runners (
                id SERIAL PRIMARY KEY,
                competition_id INTEGER NOT NULL,
                runner_id INTEGER NOT NULL,
                time REAL DEFAULT 0,
                FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
                FOREIGN KEY (runner_id) REFERENCES runners(id) ON DELETE CASCADE,
                UNIQUE (competition_id, runner_id)
            )
        `);
        console.log("✅ Database tables ensured.");
    } catch (err) {
        console.error("❌ Error setting up database:", err);
        // This is a critical error, the server can't run without a database
        process.exit(1); 
    }
};


// --- Middleware ---
app.use(express.json());
app.use(cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// --- Auth Middleware ---
const authMiddleware = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!ADMIN_PASSWORD) {
        console.error("❌ Backend PASSWORD environment variable not set!");
        return res.status(500).json({ error: "Server misconfigured" });
    }
    if (auth === ADMIN_PASSWORD) next();
    else res.status(403).json({ error: "Forbidden" });
};

// --- Routes (ALL NOW ASYNCHRONOUS) ---

// Get all runners (public)
app.get("/api/runners", async (req, res) => {
    try {
        // Use $1, $2, etc., for parameter placeholders in pg
        const result = await runQuery("SELECT * FROM runners ORDER BY rating DESC, name ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Error getting runners:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Add runner (admin)
app.post("/api/runners", authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
        // RETURNING id is the PostgreSQL way to get the new ID
        const result = await runQuery("INSERT INTO runners (name) VALUES ($1) RETURNING id", [name.trim()]);
        res.status(201).json({ message: "Runner added!", id: result.rows[0].id });
    } catch (err) {
        console.error("Error adding runner:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Update runner rating (ELO)
app.patch("/api/runners/:id/elo", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;
    if (rating == null || isNaN(rating)) return res.status(400).json({ error: "Rating is required" });
    try {
        const result = await runQuery("UPDATE runners SET rating = $1 WHERE id = $2", [rating, id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Runner ${id} not found` });
        res.json({ message: `Runner ${id} rating updated` });
    } catch (err) {
        console.error("Error updating rating:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Delete runner
app.delete("/api/runners/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await runQuery("DELETE FROM runners WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: `Runner ${id} not found` });
        res.json({ message: `Runner ${id} deleted` });
    } catch (err) {
        console.error("Error deleting runner:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Add competition
app.post("/api/competitions", authMiddleware, async (req, res) => {
    const { name, date, difficulty } = req.body;
    if (!name) return res.status(400).json({ error: "Competition name is required" });

    try {
        const result = await runQuery("INSERT INTO competitions (name, date, difficulty) VALUES ($1, $2, $3) RETURNING id", [name, date, difficulty]);
        res.status(201).json({ message: "Competition added!", id: result.rows[0].id });
    } catch (err) {
        console.error("Error adding competition:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Add runners to a competition
app.post("/api/competitions/:id/runners", authMiddleware, async (req, res) => {
    const { id: competition_id } = req.params;
    const { runners } = req.body; // [{ id: runnerId, time: 123 }, ...]
    
    if (!Array.isArray(runners) || runners.length === 0) {
        return res.status(400).json({ error: "runners must be a non-empty array" });
    }
    
    // Use a transaction for multiple inserts (best practice for multiple writes)
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction
        const stmt = `
            INSERT INTO competition_runners (competition_id, runner_id, time)
            VALUES ($1, $2, $3)
            ON CONFLICT (competition_id, runner_id) DO UPDATE SET time = EXCLUDED.time
        `;
        
        for (const r of runners) {
            const runnerId = parseInt(r.id);
            const time = parseFloat(r.time) || 0;
            if (isNaN(runnerId)) continue; 
            await client.query(stmt, [competition_id, runnerId, time]);
        }

        await client.query('COMMIT'); // End transaction
        res.json({ message: "Runners added to competition" });
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Error adding runners to competition:", err);
        res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

// Get all competitions with participants
app.get("/api/competitions", async (req, res) => {
    try {
        const competitionsResult = await runQuery("SELECT * FROM competitions ORDER BY date DESC, id DESC");
        const competitions = competitionsResult.rows;

        // Fetch participants for all competitions concurrently
        const participantsPromises = competitions.map(comp => 
            runQuery(`
                SELECT 
                    r.id, 
                    r.name, 
                    r.rating,
                    cr.time
                FROM competition_runners cr
                JOIN runners r ON r.id = cr.runner_id
                WHERE cr.competition_id = $1
                ORDER BY cr.time ASC
            `, [comp.id])
        );

        const participantsResults = await Promise.all(participantsPromises);

        // Combine competitions and participants
        const competitionsWithParticipants = competitions.map((comp, index) => {
            const participants = participantsResults[index].rows;
            return { ...comp, participants };
        });

        res.json(competitionsWithParticipants);
    } catch (err) {
        console.error("Error getting competitions:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// --- Static Frontend Serving ---

// Serve React frontend
app.use(express.static(path.join(__dirname, "dist")));

// Handle client-side routing
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start server ---
// Start the database setup and then the server
setupDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        if (!ADMIN_PASSWORD) {
            console.warn("⚠️ WARNING: The 'PASSWORD' environment variable is not set. All admin routes will fail.");
        }
    });
});