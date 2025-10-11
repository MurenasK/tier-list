// pages/Home.jsx
import Rankings from "../components/Rankings";
import RankEditor from "../components/RankEditor";

export default function Home() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400">🏆 Kauno Elitas Rankings</h1>
        <p className="text-gray-300 text-lg">Top runners in Kaunas – updated live</p>
      </header>

      {/* Rankings Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-xl shadow-lg p-4">
        <Rankings />
      </div>
    </div>
  );
}

