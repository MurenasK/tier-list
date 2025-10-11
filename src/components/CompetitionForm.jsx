import { useState, useEffect, use } from "react";
import axios from "axios";
import { calculateRatings } from "./calculateRatings";

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

  const handleSubmit = async e => {
    e.preventDefault();

    try {
      const activeCompetitors = competitors.filter(c => c.participated);

      const updatedRatings = calculateRatings({
        runners: activeCompetitors,
        competitionType: difficulty,
        specialRunnerId,
        specialRunnerPresent,
      });

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

      setMessage(`✅ Competition "${name}" saved with ${activeCompetitors.length} participants!`);
      setName("");
      setDate("");
      setDifficulty("medium");
      setCompetitors([]);
      setSpecialRunnerId(null);
      setSpecialRunnerPresent(false);
      closeForm();
    } catch (err) {
      setMessage("❌ Failed to save competition: " + err.message);
    }
  };

  return (
    <>
      <button onClick={openForm} className="open-form-btn">
        🏁 Add Competition
      </button>

      {showForm && (
        <div className="competition-modal">
          <div className="competition-card">
            <button className="close-btn" onClick={closeForm}>✖</button>
            <h2>🏟️ Add Competition</h2>

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
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="national">National</option>
                <option value="international">International</option>
              </select>

              <hr />

              <h3>🏃 Select Runners</h3>
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
                  <h3>📊 Competitor Info</h3>
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
                        Special
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
                Special runner was present
              </label>

              <hr />

              <button type="submit">💾 Save Competition</button>
            </form>

            {message && <div className="competition-message">{message}</div>}
          </div>
        </div>
      )}
    </>
  );
}
