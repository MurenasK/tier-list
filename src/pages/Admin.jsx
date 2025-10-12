// pages/Admin.jsx
import RunnerActions from "../components/RunnerActions";
import CompetitionForm from "../components/CompetitionForm";
import RankEditor from "../components/RankEditor";

export default function Admin() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">⚙️ Admino</h1>

      <section className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">🏃 Tvarkyti bėgikus</h2>
        <RunnerActions />
      </section>

      <section className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">📅 Pridėti Varžybas</h2>
        <CompetitionForm />
      </section>
    </div>
  );
}
