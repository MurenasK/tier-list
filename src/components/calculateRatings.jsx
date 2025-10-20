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

  // --- Base constants ---
  const BASE_DECAY_RATE = 0.95;
  const MIN_DECAY_FACTOR = 0.7;
  const K_FACTOR_BASE = 40; 
  const ELO_SCALE = 400; 
  const MAX_GAIN = 50; 
  const MAX_LOSS = -50; 
  const BASE_RATING = 1500;
  const RANK_IMPACT_MULTIPLIER = 0.3; 
  
  // NEW: Constants for Duration Sensitivity
  // Use the longest possible competition duration (90 minutes in milliseconds)
  const MAX_DURATION_MS = 90 * 60 * 1000; 
  // Determines how much to boost the K-factor for shorter, more intense events
  const DURATION_K_BOOST_FACTOR = 1.5; 

  const K_COMPETITION = competitionCoefficients[competitionType] || 1.0;

  // --- Derived stats ---
  const sorted = [...runners].sort((a, b) => a.rank - b.rank);
  const N = runners.length;
  const bestTime = sorted[0] ? sorted[0].time : null; // This is in milliseconds (assuming)
  const avgRating = runners.reduce((sum, r) => sum + r.rating, 0) / N;

  if (bestTime === null) {
    return runners.map(r => ({ ...r, expected: 0, performanceScore: 0, delta: 0, newRating: r.rating }));
  }

  // NEW K-FACTOR ADJUSTMENT: Shorter events have higher stakes/volatility.
  // If bestTime is 14 min, the multiplier is higher. If 90 min, it's closer to 1.
  const durationKMultiplier = 
    1 + DURATION_K_BOOST_FACTOR * (1 - Math.min(bestTime, MAX_DURATION_MS) / MAX_DURATION_MS);

  const K_ADJUSTED = K_FACTOR_BASE * K_COMPETITION * (avgRating / BASE_RATING) * durationKMultiplier;

  // --- Calculate Predicted Ranks ---
  const ratedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  const predictedRanks = new Map();
  ratedRunners.forEach((r, index) => {
    predictedRanks.set(r.id, index + 1);
  });


  // --- Main calculation ---
  const updated = runners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;

    // 1. Expected Win Probability (E_i)
    const E_i = 1 / (1 + Math.pow(10, (BASE_RATING - R_i) / ELO_SCALE));
    
    // 2. Actual Performance Score (S_i): Combination of time and placement
    
    // Time Score: 1.0 for best, < 1.0 otherwise. 
    // We use the ratio of the time *difference* to the best time.
    const TimeDeltaRatio = (time - bestTime) / bestTime;
    
    // NEW Performance Metric: Sensitivity to Time Delta
    // For the first place (TimeDeltaRatio = 0), TimePerformance = 1.0
    // For slower runners, the performance score drops faster in shorter events.
    // TimePerformance = 1 - (TimeDeltaRatio * ScalingFactor)
    const TimePerformance = 1 - TimeDeltaRatio;
    
    // Placement Score: Gives credit for placing well (1.0 for 1st place)
    const PlacementScore = (N - rank) / (N - 1); 

    // Combine Time and Placement (80% Time, 20% Placement Credit)
    const S_i = 0.8 * TimePerformance + 0.2 * PlacementScore; 

    // 3. Inactivity Decay Factor
    const monthsInactive =
      (today - new Date(lastActiveDate || today)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    
    // 4. Rating Delta (Gain/Loss) - Base ELO logic
    let delta = K_ADJUSTED * (S_i - E_i);

    // 5. Predicted Rank Bonus/Penalty
    const predictedRank = predictedRanks.get(id);
    const rankDifference = predictedRank - rank; // Positive = Performed better than predicted
    
    const RankBonus = rankDifference * RANK_IMPACT_MULTIPLIER;
    delta += RankBonus;
    
    // Apply special runner penalty
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;
      if (beatenBySpecial && delta < 0) {
        delta *= 2; 
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