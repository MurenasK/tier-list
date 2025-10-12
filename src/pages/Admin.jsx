// pages/Admin.jsx
import { useState, useEffect } from "react";
import RunnerActions from "../components/RunnerActions";
import CompetitionForm from "../components/CompetitionForm";
import RankEditor from "../components/RankEditor";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const correctPassword = "letmein123"; // 🔒 change this

  useEffect(() => {
    const storedAuth = localStorage.getItem("isAdmin");
    if (storedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === correctPassword) {
      setIsAuthenticated(true);
      localStorage.setItem("isAdmin", "true");
    } else {
      alert("Neteisingas slaptažodis ❌");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <form
          onSubmit={handleLogin}
          className="p-6 bg-white rounded-lg shadow-lg w-80 text-center"
        >
          <h2 className="text-2xl font-semibold mb-4">🔐 Admino prieiga</h2>
          <input
            type="password"
            placeholder="Įveskite slaptažodį"
            className="border p-2 w-full mb-4 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 w-full"
          >
            Prisijungti
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">⚙️ Admino</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500"
        >
          Atsijungti
        </button>
      </div>

      <section className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">🏃 Tvarkyti bėgikus</h2>
        <RunnerActions />
      </section>

      <section className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">📅 Pridėti Varžybas</h2>
        <CompetitionForm />
      </section>

      <section className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">🏁 Redaguoti reitingus</h2>
        <RankEditor />
      </section>
    </div>
  );
}
