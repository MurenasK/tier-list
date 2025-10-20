// utils/calculateRatings.js
export function calculateRatings({
  runners,
  competitionType = "local",
  today = new Date(),
  specialRunnerId = null,
  specialRunnerPresent = false,
}) {
  const competitionCoefficients = {
    local: 1.0,
    outside: 1.2,
    national: 1.5,
    international: 2.0,
  };

  // --- Base constants (Adjusted for Faceit-style +-50 range) ---
  const BASE_DECAY_RATE = 0.95;
  const MIN_DECAY_FACTOR = 0.7;
  const K_FACTOR_BASE = 40; // Base K-factor for rating change
  const ELO_SCALE = 400; // ELO difference to achieve 90% expected score
  const MAX_GAIN = 50;    // Max points gained
  const MAX_LOSS = -50;   // Max points lost
  const BASE_RATING = 1500; // A centered rating for expectation calculation
  const RANK_IMPACT_MULTIPLIER = 0.3; // Weight of the rank difference bonus

  const K_COMPETITION = competitionCoefficients[competitionType] || 1.0;

  // --- Derived stats ---
  const sorted = [...runners].sort((a, b) => a.rank - b.rank);
  const N = runners.length;
  const bestTime = sorted[0] ? sorted[0].time : null;
  const avgRating = runners.reduce((sum, r) => sum + r.rating, 0) / N;

  // K-factor adjustment based on competition strength (higher stakes for higher avg rating)
  const K_ADJUSTED = K_FACTOR_BASE * K_COMPETITION * (avgRating / BASE_RATING);

  if (bestTime === null) {
    return runners.map(r => ({ ...r, expected: 0, performanceScore: 0, delta: 0, newRating: r.rating }));
  }

  // --- Calculate Predicted Ranks (based on current ratings) ---
  // 1. Sort runners by rating (descending) to determine their predicted rank
  const ratedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  const predictedRanks = new Map();
  ratedRunners.forEach((r, index) => {
    predictedRanks.set(r.id, index + 1);
  });


  // --- Main calculation ---
  const updated = runners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;

    // 1. Expected Win Probability (E_i): Compared against the BASE_RATING (e.g., 1500)
    const E_i = 1 / (1 + Math.pow(10, (BASE_RATING - R_i) / ELO_SCALE));
    
    // 2. Actual Performance Score (S_i): Combination of time and placement
    const TimeRatio = bestTime / time; // Time Score: 1.0 for best, < 1.0 otherwise
    
    // Placement Score: Gives credit for placing well (e.g., rank 2/N)
    // 1.0 for 1st place, 0.0 for last place
    const PlacementScore = (N - rank) / (N - 1); 

    // Combine Time and Placement (80% Time, 20% Placement Credit)
    // This ensures that 2nd and 3rd place runners with close times still score well.
    const S_i = 0.8 * Math.pow(TimeRatio, 2) + 0.2 * PlacementScore; 

    // 3. Inactivity Decay Factor
    const monthsInactive =
      (today - new Date(lastActiveDate || today)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    
    // 4. Rating Delta (Gain/Loss) - Base ELO logic
    let delta = K_ADJUSTED * (S_i - E_i);

    // 5. Predicted Rank Bonus/Penalty (New Logic)
    const predictedRank = predictedRanks.get(id);
    const rankDifference = predictedRank - rank; // Positive = Performed better than predicted
    
    // A bonus/penalty that scales with the rank difference
    const RankBonus = rankDifference * RANK_IMPACT_MULTIPLIER;
    
    // Apply Rank Bonus/Penalty to the delta (but keep it capped)
    delta += RankBonus;
    
    // Apply special runner penalty
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;
      if (beatenBySpecial && delta < 0) {
        delta *= 2; // double the loss
      }
    }

    // 6. Cap values and make it an INTEGER (no decimals)
    delta = Math.max(Math.min(delta, MAX_GAIN), MAX_LOSS);
    const integerDelta = Math.round(delta);
    
    // 7. Calculate New Rating (Apply Decay *before* delta) and make it an INTEGER
    const newRating = Math.round(R_i * DecayFactor + integerDelta);

    return {
      ...r,
      expected: parseFloat(E_i.toFixed(3)),
      performanceScore: parseFloat(S_i.toFixed(3)),
      predictedRank: predictedRank,
      delta: integerDelta,
      newRating: newRating,
    };
  });

  return updated;
}