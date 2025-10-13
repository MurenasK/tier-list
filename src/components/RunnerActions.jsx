import React, { useState, useEffect, useRef } from "react";

export default function RunnerActions() {
  const [runners, setRunners] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const hasFetched = useRef(false); // prevent multiple fetches

  useEffect(() => {
    if (!hasFetched.current) {
      const fetchRunners = async () => {
        try {
          const res = await fetch("/api/runners");
          const data = await res.json();
          setRunners(data);
          hasFetched.current = true;
        } catch (err) {
          console.error(err);
          setMessage("❌ Nepavyko gauti bėgikų");
        }
      };
      fetchRunners();
    }
  }, []);

  const addRunner = async () => {
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/runners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Nepavyko pridėti bėgiko");
      const data = await res.json();
      setRunners(prev => [...prev, { id: data.id, name, rating: 1000 }]);
      setMessage("✅ Bėgikas pridėtas");
      setName("");
    } catch (err) {
      console.error(err);
      setMessage("❌ Pridėti bėgiko nepavyko");
    }
  };

  const deleteRunner = async (id) => {
    try {
      const res = await fetch(`/api/runners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Nepavyko ištrinti");
      setRunners(prev => prev.filter(r => r.id !== id));
      setMessage(`🗑️ Bėgikas ${id} ištrintas`);
    } catch (err) {
      console.error(err);
      setMessage("❌ Trinti nepavyko");
    }
  };

  const updateRating = (() => {
    let timeout;
    return (id, rating) => {
      setRunners(prev =>
        prev.map(r => (r.id === id ? { ...r, rating } : r))
      );
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/runners/${id}/elo`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating }),
          });
          if (!res.ok) throw new Error("Nepavyko atnaujinti reitingo");
          setMessage(`🏅 Bėgiko ${id} reitingas atnaujintas`);
        } catch (err) {
          console.error(err);
          setMessage("❌ Reitingo atnaujinti nepavyko");
        }
      }, 500); // debounce to avoid flooding requests
    };
  })();

  return (
    <div className="runner-actions-card">
      <h2>Bėgikų veiksmai</h2>

      <div className="add-runner">
        <input
          type="text"
          placeholder="Bėgiko vardas"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={addRunner}>Pridėti bėgiką</button>
      </div>

      {message && <div className="message">{message}</div>}

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
          {runners.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>
                <input
                  type="number"
                  value={r.rating ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setRunners(prev =>
                      prev.map(rr => rr.id === r.id ? { ...rr, rating: val } : rr)
                    );
                  }}
                  onBlur={e => updateRating(r.id, parseFloat(e.target.value) || 0)}
                />
              </td>
              <td>
                <button onClick={() => deleteRunner(r.id)}>Naikinti</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
