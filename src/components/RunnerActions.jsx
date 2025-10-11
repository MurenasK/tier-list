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
    const payload = { rating };
    const res = await fetch(`http://localhost:4000/api/runners/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: PASSWORD,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update rating");
    setMessage(`🏅 Runner ${id} rating updated`);
    fetchRunners();
  } catch (err) {
    console.error(err);
    setMessage("❌ Failed to update rating: " + (err.message || ""));
  }
};


  const handleRankChange = (id, value) => {
    setRunners(prev => prev.map(r => r.id === id ? { ...r, rating: value } : r));
  };

  const handleRankBlur = (id, value) => {
    const parsed = Number(value);
    updateRank(id, Number.isNaN(parsed) ? null : parsed);
  };

  return (
    <div className="runner-actions-card">
      <h2>Runner Actions</h2>

      <div className="add-runner">
        <input
          type="text"
          placeholder="Runner name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={addRunner}>Add Runner</button>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="runner-list">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Vardas</th>
              <th>Rank</th>
              <th>Actions</th>
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
                    defaultValue={runner.rating ?? ""}
                    onChange={(e) =>
                      setRunners(prev => prev.map(r => r.id === runner.id ? { ...r, rating: e.target.value } : r))
                    }
                    onBlur={(e) => {
                      const parsed = Number(e.target.value);
                      updateRating(runner.id, Number.isNaN(parsed) ? null : parsed);
                    }}
                  />
                </td>
                <td>
                  <button onClick={() => deleteRunner(runner.id)}>
                    Delete
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
