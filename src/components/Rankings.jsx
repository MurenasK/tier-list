import { useState, useEffect } from "react";
import axios from "axios";

export default function Rankings() {
  const [runners, setRunners] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:4000/api/runners")
      .then((res) => setRunners(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="rankings-card">
      <table className="rankings-table">
        <thead>
          <tr>
            <th>Vieta</th>
            <th>Begikas</th>
            <th>Reitingas</th>
          </tr>
        </thead>
        <tbody>
          {runners
            .sort((a, b) => b.rating - a.rating)
            .map((runner, i, arr) => {
              // If this runner has the same rating as the previous one → same rank
              const rank =
                i > 0 && runner.rating === arr[i - 1].rating
                  ? arr[i - 1].rank
                  : i + 1;
              runner.rank = rank; // attach rank so it can be reused for the next comparison

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
