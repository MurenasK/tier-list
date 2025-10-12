import { useState, useEffect, use } from "react";
import axios from "axios";
import { calculateRatings } from "./calculateRatings";
import "./CompsStyling/CompetitionForm.css";

export default function CompetitionForm() {
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [competitors, setCompetitors] = useState([]);
  const [specialRunnerId, setSpecialRunnerId] = useState(null);
  const [specialRunnerPresent, setSpecialRunnerPresent] = useState(false);
  const [message, setMessage] = useState("");
  const [allRunners, setAllRunners] = useState([]);

  const PASSWORD = "NiggasInParis"; // change this

  const openForm = () => setShowForm(true);
  const closeForm = () => setShowForm(false);

  useEffect(() => {
    // Fetch all runners on mount
    const fetchRunners = async () => {
      try {
        const res = await axios.get("http://localhost:4000/api/runners");
        setAllRunners(res.data);
      } catch (err) {
        console.error("Failed to fetch runners:", err);
      }
    };

    fetchRunners();
  })

  const handleAddRunner = runner => {
    // Only add if not already added
    if (!competitors.find(c => c.id === runner.id)) {
      setCompetitors(prev => [
        ...prev,
        { ...runner, time: 0, participated: true },
      ]);
    }
  };

  const updateCompetitor = (id, key, value) => {
    setCompetitors(prev =>
      prev.map(c => (c.id === id ? { ...c, [key]: value } : c))
    );
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const activeCompetitors = competitors.filter(c => c.participated);

    // 🧮 1️⃣ Calculate new ratings using your existing function
    const updatedRatings = calculateRatings({
      runners: activeCompetitors,
      competitionType: difficulty,
      specialRunnerId,
      specialRunnerPresent,
    });

    // 💾 2️⃣ Save competition info to the backend
    await axios.post(
      "http://localhost:4000/api/competitions",
      {
        name,
        date,
        difficulty,
        competitors: updatedRatings,
        specialRunnerPresent,
        specialRunnerId,
      },
      { headers: { Authorization: PASSWORD } }
    );

    // 🔁 3️⃣ Update each runner’s rating in your runners table
    await Promise.all(
      updatedRatings.map(async (runner) => {
        try {
          await axios.put(`http://localhost:4000/api/runners/${runner.id}`, {
            rating: runner.newRating,
            lastActiveDate: new Date().toISOString(),
          });
        } catch (err) {
          console.warn(`⚠️ Failed to update runner ${runner.name}:`, err);
        }
      })
    );

    // 🧠 4️⃣ Update local state so UI reflects new ratings instantly
    setAllRunners((prev) =>
      prev.map((r) => {
        const updated = updatedRatings.find((u) => u.id === r.id);
        return updated ? { ...r, rating: updated.newRating } : r;
      })
    );

    // ✅ 5️⃣ Success message
    setMessage(`✅ Competition "${name}" saved & ratings updated!`);
    setTimeout(() => setMessage(""), 4000);

    // ♻️ 6️⃣ Reset form
    setName("");
    setDate("");
    setDifficulty("medium");
    setCompetitors([]);
    setSpecialRunnerId(null);
    setSpecialRunnerPresent(false);
    closeForm();
  } catch (err) {
    console.error("❌ Error submitting competition:", err);
    setMessage("❌ Failed to save competition or update ratings: " + err.message);
  }
};


  return (
    <>
      <button onClick={openForm} className="open-form-btn">
        🏁 Pridėti varžybas
      </button>

      {showForm && (
        <div className="competition-modal">
          <div className="competition-card">
            <button className="close-btn" onClick={closeForm}>✖</button>
            <h2>🏟️ Varžybos</h2>

            <form onSubmit={handleSubmit} className="competition-form">
              <input
                type="text"
                placeholder="Competition name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
              >
                <option value="easy">Kaimo lyga</option>
                <option value="medium">Užsienio random</option>
                <option value="national">LT Čampas</option>
                <option value="international">Užsienio už LT</option>
              </select>

              <hr />

              <h3>🏃 Pasirinkti bėgikus</h3>
              <div className="runner-list">
                {allRunners.map(r => (
                  <div key={r.id} className="runner-select-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={!!competitors.find(c => c.id === r.id)?.participated}
                        onChange={e =>
                          e.target.checked
                            ? handleAddRunner(r)
                            : setCompetitors(prev =>
                                prev.filter(c => c.id !== r.id)
                              )
                        }
                      />
                      {r.name}
                    </label>
                  </div>
                ))}
              </div>

              {competitors.length > 0 && (
                <>
                  <hr />
                  <h3>📊 Info</h3>
                  {competitors.map(c => (
                    <div key={c.id} className="competitor-row">
                      <span>{c.name}</span>
                      <input
                        type="number"
                        placeholder="Time (sec)"
                        value={c.time}
                        onChange={e =>
                          updateCompetitor(c.id, "time", parseFloat(e.target.value))
                        }
                        required
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={specialRunnerId === c.id}
                          disabled={!specialRunnerPresent}
                          onChange={() =>
                            setSpecialRunnerId(specialRunnerId === c.id ? null : c.id)
                          }
                        />
                        JANUŠIS?
                      </label>
                    </div>
                  ))}
                </>
              )}

              <label style={{ display: "block", marginTop: "10px" }}>
                <input
                  type="checkbox"
                  checked={specialRunnerPresent}
                  onChange={() => setSpecialRunnerPresent(!specialRunnerPresent)}
                />{" "}
                JANUŠIS DALYVAUJA?
              </label>

              <hr />

              <button type="submit">💾 Išsaugoti varžybas</button>
            </form>

            {message && <div className="competition-message">{message}</div>}
          </div>
        </div>
      )}
    </>
  );
}
