import { useState } from "react";
import axios from "axios";

export default function RankEditor() {
  const [runnerId, setRunnerId] = useState("");
  const [elo, setElo] = useState("");
  const PASSWORD = "NiggasInParis";
  const API_URL = "http://localhost:4000/api";

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(
        `${API_URL}/runners/${runnerId}`,
        { elo: Number(elo) },
        { headers: { Authorization: PASSWORD } }
      );
      alert("Rank updated!");
      setRunnerId("");
      setElo("");
    } catch (err) {
      alert("Failed to update rank: " + err.message);
    }
  };

  return (
    <div className="rank-editor">
      <h2>✏️ Edit Runner Rank</h2>
      <form onSubmit={handleUpdate}>
        <input
          type="number"
          placeholder="Runner ID"
          value={runnerId}
          onChange={(e) => setRunnerId(e.target.value)}
        />
        <input
          type="number"
          placeholder="New ELO"
          value={elo}
          onChange={(e) => setElo(e.target.value)}
        />
        <button type="submit">Update</button>
      </form>
    </div>
  );
}
