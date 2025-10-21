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

  // --- Base constants (Dampened K-factor) ---
  const BASE_DECAY_RATE = 0.95;
  const MIN_DECAY_FACTOR = 0.7;
  
  const K_FACTOR_BASE = 20; 
  const ELO_SCALE = 400; 
  const MAX_GAIN = 50; 
  const MAX_LOSS = -50; 
  
  // Used as the center point for K-factor normalization (e.g., standard starting rating)
  const RATING_NORMALIZER = 1500; 
  // Scale factor for the K-factor normalization curve (higher number = less dampening)
  const K_DECAY_RATING_SCALE = 300;
  
  const RANK_IMPACT_MULTIPLIER = 0.3; 
  
  const K_COMPETITION = competitionCoefficients[competitionType] || 1.0;

  // --- Derived stats ---
  const N = runners.length;
  const sorted = [...runners].sort((a, b) => a.time - b.time); // Sort by time to assign rank and find bestTime
  const bestTime = sorted[0] ? sorted[0].time : null; 
  const totalRating = runners.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = totalRating / N;

  if (bestTime === null || N < 2) {
    return runners.map(r => ({ ...r, expected: 0, performanceScore: 0, delta: 0, newRating: r.rating }));
  }
    
  // Assign actual ranks based on time (1st place gets rank 1)
  const rankedRunners = sorted.map((r, index) => ({...r, rank: index + 1}));

  // K-FACTOR ADJUSTMENT (Simplified to base and competition only)
  // Individual runner K-factor normalization will be calculated inside the map loop.
  const K_BASE_ADJUSTED = K_FACTOR_BASE * K_COMPETITION;


  // --- Calculate Predicted Ranks (based on current ratings) ---
  const ratedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  const predictedRanks = new Map();
  ratedRunners.forEach((r, index) => {
    predictedRanks.set(r.id, index + 1);
  });


  // --- Main calculation ---
  const updated = rankedRunners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;

    // 1. Expected Score (E_i): Calculated against the Competition Average Rating.
    const E_i = 1 / (1 + Math.pow(10, (avgRating - R_i) / ELO_SCALE));
    
    // 2. Actual Performance Score (S_i): Combination of time and placement
    const TimeDeltaRatio = (time - bestTime) / bestTime; 
    
    // Time Performance: Exponential decay from 1.0. 
    // *** Harsher penalty on slow times: Coefficient -4 ***
    const TimePerformance = Math.exp(-4 * TimeDeltaRatio); 

    // Placement Score: Gives credit for placing well (1.0 for 1st place)
    const PlacementScore = (N - rank) / (N - 1 || 1); 

    // S_i is the weighted actual performance score (closer to 1.0 is better)
    const S_i = 0.8 * TimePerformance + 0.2 * PlacementScore; 

    // 3. Inactivity Decay Factor
    const monthsInactive =
      (today - new Date(lastActiveDate || today)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    
    // --- RATING NORMALIZATION / K-FACTOR DECAY ---
    const kDecayMultiplier = 
      1 / (1 + Math.exp((R_i - RATING_NORMALIZER) / K_DECAY_RATING_SCALE));
    
    const K_i = K_BASE_ADJUSTED * kDecayMultiplier;

    // 4. Rating Delta (Gain/Loss) - Standard ELO logic
    let delta = K_i * (S_i - E_i);

    // 5. Predicted Rank Bonus/Penalty
    const predictedRank = predictedRanks.get(id);
    const rankDifference = predictedRank - rank; 
    
    const RankBonus = rankDifference * RANK_IMPACT_MULTIPLIER;
    delta += RankBonus;
    
    // 6. Apply special runner penalty (REVISED LOGIC)
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;

      if (beatenBySpecial) {
        // ** GUARANTEED PENALTY LOGIC **
        // Penalty is based on the runner's K-factor and their ELO expectation (E_i).
        // This ensures the penalty is relative to the runner's rating and is large enough to negate small gains.
        const guaranteedPenalty = K_i * E_i; 

        // If the runner's delta is positive (or zero), we nullify it first.
        if (delta >= 0) {
          delta = 0;
        }

        // Apply the guaranteed penalty. This will turn any zero/small positive delta into a loss, 
        // and significantly increase any existing loss.
        delta -= guaranteedPenalty;
      }
    }

    // 7. Cap values and make it an INTEGER (-50 to 50)
    delta = Math.max(Math.min(delta, MAX_GAIN), MAX_LOSS);
    const integerDelta = Math.round(delta);
    
    // 8. Calculate New Rating (Apply Decay *before* delta) and make it an INTEGER
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
