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

  // --- Base constants (Dampened K-factor) ---
  const BASE_DECAY_RATE = 0.95;
  const MIN_DECAY_FACTOR = 0.7;
  // FIX 1: Reduced Base K-factor from 40 to 30 to dampen volatility
  const K_FACTOR_BASE = 30; 
  const ELO_SCALE = 400; 
  const MAX_GAIN = 50; 
  const MAX_LOSS = -50; 
  // BASE_RATING is now only used for the K-factor normalization, not E_i
  const RATING_NORMALIZER = 1500; 
  const RANK_IMPACT_MULTIPLIER = 0.3; 
  
  // Constants for Duration Sensitivity (Kept conservative)
  const MAX_DURATION_MS = 90 * 60 * 1000; 
  const DURATION_K_BOOST_FACTOR = 0.5; 

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

  // K-FACTOR ADJUSTMENT
  const durationKMultiplier = 
    1 + DURATION_K_BOOST_FACTOR * (1 - Math.min(bestTime, MAX_DURATION_MS) / MAX_DURATION_MS);

  // Normalization based on average rating vs. standard (1500)
  const ratingNormalizationFactor = avgRating / RATING_NORMALIZER; 
  
  const K_ADJUSTED = K_FACTOR_BASE * K_COMPETITION * ratingNormalizationFactor * durationKMultiplier;


  // --- Calculate Predicted Ranks (based on current ratings) ---
  const ratedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  const predictedRanks = new Map();
  ratedRunners.forEach((r, index) => {
    predictedRanks.set(r.id, index + 1);
  });


  // --- Main calculation ---
  const updated = rankedRunners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;

    // FIX 2: Expected Score (E_i) is calculated against the Competition Average Rating.
    // This centers the expectation around the group's performance.
    // Runners above avgRating will have E_i > 0.5 (expected to perform better than average)
    // Runners below avgRating will have E_i < 0.5 (expected to perform worse than average)
    const E_i = 1 / (1 + Math.pow(10, (avgRating - R_i) / ELO_SCALE));
    
    // 2. Actual Performance Score (S_i): Combination of time and placement
    const TimeDeltaRatio = (time - bestTime) / bestTime; 
    
    // Time Performance: Exponential decay from 1.0. 
    // This is the actual score achieved based on time.
    const TimePerformance = Math.exp(-2 * TimeDeltaRatio); 

    // Placement Score: Gives credit for placing well (1.0 for 1st place)
    const PlacementScore = (N - rank) / (N - 1 || 1); 

    // S_i is the weighted actual performance score (closer to 1.0 is better)
    const S_i = 0.8 * TimePerformance + 0.2 * PlacementScore; 

    // 3. Inactivity Decay Factor
    const monthsInactive =
      (today - new Date(lastActiveDate || today)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    
    // 4. Rating Delta (Gain/Loss) - Base ELO logic
    let delta = K_ADJUSTED * (S_i - E_i);

    // 5. Predicted Rank Bonus/Penalty
    const predictedRank = predictedRanks.get(id);
    const rankDifference = predictedRank - rank; 
    
    const RankBonus = rankDifference * RANK_IMPACT_MULTIPLIER;
    delta += RankBonus;
    
    // Apply special runner penalty (Existing logic)
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;
      if (beatenBySpecial && delta < 0) {
        delta *= 2; 
      }
    }

    // 6. Cap values and make it an INTEGER
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