// pages/Home.jsx
import Rankings from "../components/Rankings";
import RankEditor from "../components/RankEditor";

export default function Home() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400">🏆 Kauno Elito Retingai</h1>
      </header>

      {/* Rankings Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-xl shadow-lg p-4">
        <Rankings />
      </div>
    </div>
  );
}

