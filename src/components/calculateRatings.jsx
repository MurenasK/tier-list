// utils/calculateRatings.js
export function calculateRatings({
  runners,
  competitionType = "local",
  today = new Date(),
  specialRunnerId = null,
  specialRunnerPresent = false,
}) {
  const competitionCoefficients = {
    easy: 0.8,
    medium: 1.0,
    hard: 1.5,
    national: 1.5,
    international: 2.0,
  };

  const BASE_DECAY_RATE = 0.95;
  const MIN_DECAY_FACTOR = 0.7;
  const MAX_GAIN = 50;
  const MAX_LOSS = -50;
  const TIME_IMPACT_DIVISOR = 5;
  const EXPECTATION_SPREAD = 400;

  const K = competitionCoefficients[competitionType] || 1.0;

  const sorted = [...runners].sort((a, b) => a.rank - b.rank);
  const L = Math.max(...runners.map(r => r.rating));
  const avgTop5 =
    sorted
      .slice(0, Math.min(5, sorted.length))
      .reduce((acc, r) => acc + r.rating, 0) / Math.min(5, sorted.length);

  const K_adj = K * (avgTop5 / 2000);
  const avgTime = runners.reduce((sum, r) => sum + r.time, 0) / runners.length;

  const updated = runners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;
    const E_i = 1 / (1 + Math.pow(10, (L - R_i) / EXPECTATION_SPREAD));
    const S_i = (runners.length - rank + 1) / runners.length;
    const TPF_i = 1 + ((avgTime - time) / avgTime) / TIME_IMPACT_DIVISOR;

    const monthsInactive =
      (today - new Date(lastActiveDate)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    const Balance = 1 - R_i / (L + 200);

    // Base rating change
    let delta = K_adj * (S_i - E_i) * Balance * TPF_i;

    // ✅ Apply penalty only if special runner present and you were beaten by him
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;
      if (beatenBySpecial && delta < 0) {
        delta = delta * 2; // double the loss only if it's negative
      }
    }

    delta = Math.max(Math.min(delta, MAX_GAIN), MAX_LOSS);
    const newRating = R_i * DecayFactor + delta;

    return {
      ...r,
      expected: E_i.toFixed(3),
      placementScore: S_i.toFixed(3),
      delta: delta.toFixed(2),
      newRating: parseFloat(newRating.toFixed(2)),
    };
  });

  return updated;
}
