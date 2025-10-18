import { useState, useEffect } from "react";
import api from "./api"; // 👈 centralized Axios instance

export default function Rankings() {
  const [runners, setRunners] = useState([]);

  useEffect(() => {
    const fetchRunners = async () => {
      try {
        const res = await api.get("/api/runners");
        setRunners(res.data);
      } catch (err) {
        console.error("Nepavyko gauti bėgikų:", err);
      }
    };

    fetchRunners();
  }, []);

  // Sort runners and calculate rank (ties get same rank)
  const sortedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  let lastRating = null;
  let lastRank = 0;

  return (
    <div className="rankings-card">
      <table className="rankings-table">
        <thead>
          <tr>
            <th>Vieta</th>
            <th>Bėgikas</th>
            <th>Reitingas</th>
          </tr>
        </thead>
        <tbody>
          {sortedRunners.map((runner, i) => {
            const rank = runner.rating === lastRating ? lastRank : i + 1;
            lastRating = runner.rating;
            lastRank = rank;

            return (
              <tr key={runner.id}>
                <td>{rank}</td>
                <td>{runner.name}</td>
                <td>{runner.rating}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
