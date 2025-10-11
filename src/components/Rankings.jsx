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
            .map((runner, i) => (
              <tr key={runner.id}>
                <td>{i + 1}</td>
                <td>{runner.name}</td>
                <td>{runner.rating}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
