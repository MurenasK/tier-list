import React, { useState, useEffect } from "react";

function RunnerActions() {
  const [runners, setRunners] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const PASSWORD = "NiggasInParis";

  // Load runners
  const fetchRunners = async () => {
    const res = await fetch("http://localhost:4000/api/runners");
    const data = await res.json();
    setRunners(data);
  };

  useEffect(() => {
    fetchRunners();
  }, []);

  // Add runner
  const addRunner = async () => {
    if (!name.trim()) return;
    try {
      const res = await fetch("http://localhost:4000/api/runners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: PASSWORD,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error("Failed to add runner");
      setMessage("✅ Runner added!");
      setName("");
      fetchRunners();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to add runner");
    }
  };

  // Delete runner
  const deleteRunner = async (id) => {
    try {
      const res = await fetch(`http://localhost:4000/api/runners/${id}`, {
        method: "DELETE",
        headers: { Authorization: PASSWORD },
      });
      if (!res.ok) throw new Error("Failed to delete runner");
      setMessage(`🗑️ Runner ${id} deleted`);
      fetchRunners();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to delete runner");
    }
  };

  // Update rating
  const updateRating = async (id, rating) => {
    try {
      const parsedRating = Number(rating);
      if (Number.isNaN(parsedRating)) {
        setMessage("❌ Invalid rating value");
        return;
      }

      const res = await fetch(`http://localhost:4000/api/runners/${id}/elo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: PASSWORD,
        },
        body: JSON.stringify({ rating: parsedRating }), // must be "rating"
      });

      if (!res.ok) throw new Error("Failed to update rating");

      setMessage(`🏅 Runner ${id} rating updated`);
      fetchRunners();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to update rating: " + (err.message || ""));
    }
};

  return (
    <div className="runner-actions-card">
      <h2>Bėgikų veiksmai</h2>

      <div className="add-runner">
        <input
          type="text"
          placeholder="Runner name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={addRunner}>Pridėti bėgiką</button>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="runner-list">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Vardas</th>
              <th>Reitingas</th>
              <th>Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {runners.map((runner) => (
              <tr key={runner.id}>
                <td>{runner.id}</td>
                <td>{runner.name}</td>
                <td>
                  <input
                    type="number"
                    defaultValue={runner.rating ?? 0}
                    onChange = {(e) => {
                      const val = parseFloat(e.target.value);
                      setRunners(prev =>
                        prev.map(r =>
                          r.id === runner.id ? { ...r, rating: Number.isNaN(val) ? 0 : val } : r
                        )
                      );
                    }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      updateRating(runner.id, Number.isNaN(val) ? 0 : val);
                    }}
                  />
                </td>
                <td>
                  <button onClick={() => deleteRunner(runner.id)}>
                    Naikinti
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RunnerActions;
