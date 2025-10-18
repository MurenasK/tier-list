import { useState, useEffect, useRef } from "react";
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
  const hasFetched = useRef(false);

  // 👇 same password used in your backend authMiddleware
  const PASSWORD = "NiggasInParis";

  useEffect(() => {
    if (!hasFetched.current) {
      const fetchRunners = async () => {
        try {
          const res = await axios.get("http://localhost:4000/api/runners");
          setAllRunners(res.data);
          hasFetched.current = true;
        } catch (err) {
          console.error("Nepavyko gauti bėgikų:", err);
        }
      };
      fetchRunners();
    }
  }, []);

  const handleAddRunner = runner => {
    if (!competitors.find(c => c.id === runner.id)) {
      setCompetitors(prev => [...prev, { ...runner, time: 0, participated: true }]);
    }
  };

  const updateCompetitor = (id, key, value) => {
    setCompetitors(prev => prev.map(c => (c.id === id ? { ...c, [key]: value } : c)));
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

      // Save competition
      const compRes = await axios.post(
        "http://localhost:4000/api/competitions",
        { name, date, difficulty },
        { headers: { Authorization: PASSWORD } }
      );
      const competitionId = compRes.data.id;

      // Add competitors
      await axios.post(
        `http://localhost:4000/api/competitions/${competitionId}/runners`,
        {
          runners: activeCompetitors.map(c => ({
            id: c.id,
            time: c.time || 0,
          })),
        },
        { headers: { Authorization: PASSWORD } }
      );

      // Update ratings
      await Promise.all(
        updatedRatings.map(r =>
          axios.patch(
            `http://localhost:4000/api/runners/${r.id}/elo`,
            { rating: r.newRating },
            { headers: { Authorization: PASSWORD } }
          )
        )
      );

      // Update local runners
      setAllRunners(prev =>
        prev.map(r => {
          const updated = updatedRatings.find(u => u.id === r.id);
          return updated ? { ...r, rating: updated.newRating } : r;
        })
      );

      setMessage(`✅ Varžybos "${name}" išsaugotos!`);
      setTimeout(() => setMessage(""), 4000);

      // Reset form
      setName("");
      setDate("");
      setDifficulty("medium");
      setCompetitors([]);
      setSpecialRunnerId(null);
      setSpecialRunnerPresent(false);
      setShowForm(false);
    } catch (err) {
      console.error("❌ Error submitting competition:", err);
      if (err.response) {
        console.log("Status:", err.response.status);
        console.log("Data:", err.response.data);
      }
      setMessage("❌ Nepavyko išsaugoti varžybų");
    }
  };

  return (
    <>
      <button onClick={() => setShowForm(true)} className="open-form-btn">
        🏁 Pridėti varžybas
      </button>

      {showForm && (
        <div className="competition-modal">
          <div className="competition-card">
            <button className="close-btn" onClick={() => setShowForm(false)}>
              ✖
            </button>
            <h2>🏟️ Varžybos</h2>

            <form onSubmit={handleSubmit} className="competition-form">
              <input
                type="text"
                placeholder="Varžybų pavadinimas"
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
                <option value="local">Kaimo lyga</option>
                <option value="outside">Užsienio random</option>
                <option value="national">LT Čempionatas</option>
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
                        value={c.time ?? 0}
                        onChange={e =>
                          updateCompetitor(
                            c.id,
                            "time",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        required
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={specialRunnerId === c.id}
                          disabled={!specialRunnerPresent}
                          onChange={() =>
                            setSpecialRunnerId(
                              specialRunnerId === c.id ? null : c.id
                            )
                          }
                        />{" "}
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
                  onChange={() =>
                    setSpecialRunnerPresent(!specialRunnerPresent)
                  }
                />{" "}
                JANUŠIS DALYVAUJA?
              </label>

              <hr />
              <button type="submit">💾 Išsaugoti varžybas</button>
            </form>

            {message && (
              <div className="competition-message">{message}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
