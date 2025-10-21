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
  
  // K_FACTOR_BASE sumažintas iki 10, siekiant dar labiau sumažinti taškų svyravimus.
  const K_FACTOR_BASE = 10; 
  const ELO_SCALE = 400; 
  const MAX_GAIN = 50; 
  const MAX_LOSS = -50; 
  
  // Naudojamas kaip centrinis taškas K-faktoriaus normalizavimui
  const RATING_NORMALIZER = 1500; 
  // K-faktoriaus normalizavimo kreivės mastelio koeficientas
  const K_DECAY_RATING_SCALE = 300;
  
  const RANK_IMPACT_MULTIPLIER = 0.3; 
  
  // UŽTIKRINIMAS: Jei competitionType yra ne stringas (pvz., skaičius 1.5, 15, ar 20),
  // naudosime jį tiesiogiai, kitaip bandysime rasti koeficientą pagal raktą.
  let K_COMPETITION;
  if (typeof competitionType === 'number') {
    // Jei competitionType yra skaičius, tiesiog jį naudojame. (Pvz., 1.5)
    K_COMPETITION = competitionType;
  } else {
    // Jei competitionType yra stringas (pvz., "national"), ieškome koeficiento.
    K_COMPETITION = competitionCoefficients[competitionType] || 1.0;
  }
  

  // --- Išvestinė statistika ---
  const N = runners.length;
  const sorted = [...runners].sort((a, b) => a.time - b.time); // Rūšiuoti pagal laiką, kad būtų nustatyta vieta ir rastas geriausias laikas
  const bestTime = sorted[0] ? sorted[0].time : null; 
  const totalRating = runners.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = totalRating / N;

  if (bestTime === null || N < 2) {
    return runners.map(r => ({ ...r, expected: 0, performanceScore: 0, delta: 0, newRating: r.rating }));
  }
    
  // Priskirti faktines vietas pagal laiką (1-oji vieta gauna 1-ąjį rangą)
  const rankedRunners = sorted.map((r, index) => ({...r, rank: index + 1}));

  // K-FAKTORIAUS REGULIAVIMAS (Individualaus bėgiko K-faktoriaus normalizavimas bus skaičiuojamas viduje)
  const K_BASE_ADJUSTED = K_FACTOR_BASE * K_COMPETITION;


  // --- Apskaičiuoti Numatytas Vieta (pagal dabartinius reitingus) ---
  const ratedRunners = [...runners].sort((a, b) => b.rating - a.rating);
  const predictedRanks = new Map();
  ratedRunners.forEach((r, index) => {
    predictedRanks.set(r.id, index + 1);
  });


  // --- Pagrindinis skaičiavimas ---
  const updated = rankedRunners.map(r => {
    const { rating: R_i, rank, time, id, lastActiveDate } = r;

    // 1. Numatytas Rezultatas (E_i): Apskaičiuojamas pagal Vidutinį Varžybų Reitingą.
    const E_i = 1 / (1 + Math.pow(10, (avgRating - R_i) / ELO_SCALE));
    
    // 2. Faktinis Veiklos Rezultatas (S_i): Laiko ir vietos derinys
    const TimeDeltaRatio = (time - bestTime) / bestTime; 
    
    // Laiko Veikla: Eksponentinis nuosmukis nuo 1.0. 
    // Griežtesnė bauda už lėtą laiką: Koeficientas -4
    const TimePerformance = Math.exp(-4 * TimeDeltaRatio); 

    // Vietos Rezultatas: Pridedami taškai už gerą vietą (1.0 už 1-ąją vietą)
    const PlacementScore = (N - rank) / (N - 1 || 1); 

    // S_i yra svertinis faktinis veiklos rezultatas (kuo arčiau 1.0, tuo geriau)
    const S_i = 0.8 * TimePerformance + 0.2 * PlacementScore; 

    // 3. Neveiklumo Nuosmukio Koeficientas
    const monthsInactive =
      (today - new Date(lastActiveDate || today)) / (1000 * 60 * 60 * 24 * 30);
    const DecayFactor = Math.max(Math.pow(BASE_DECAY_RATE, monthsInactive), MIN_DECAY_FACTOR);
    
    // --- REITINGO NORMALIZAVIMAS / K-FAKTORIAUS NUOSMUKIS ---
    const kDecayMultiplier = 
      1 / (1 + Math.exp((R_i - RATING_NORMALIZER) / K_DECAY_RATING_SCALE));
    
    const K_i = K_BASE_ADJUSTED * kDecayMultiplier;

    // 4. Reitingo Delta (Pelnas/Nuostolis) - Standartinė ELO logika
    let delta = K_i * (S_i - E_i);

    // 5. Numatytos Vietos Premija/Bauda
    const predictedRank = predictedRanks.get(id);
    const rankDifference = predictedRank - rank; 
    
    const RankBonus = rankDifference * RANK_IMPACT_MULTIPLIER;
    delta += RankBonus;
    
    // 6. Taikyti specialaus bėgiko baudą (ATNAUJINTA LOGIKA)
    if (specialRunnerPresent && specialRunnerId) {
      const specialRunner = runners.find(rn => rn.id === specialRunnerId);
      const beatenBySpecial = specialRunner && rank > specialRunner.rank;

      if (beatenBySpecial) {
        // ** GARANTUOTOS BAUDOS LOGIKA **
        const guaranteedPenalty = K_i * E_i; 

        // Jei bėgiko delta yra teigiama (arba nulis), pirmiausia ją anuliuojame.
        if (delta >= 0) {
          delta = 0;
        }

        // Taikome garantuotą baudą.
        delta -= guaranteedPenalty;
      }
    }

    // 7. Apribojame reikšmes ir paverčiame SVEIKAISIAIS SKAIČIAIS (-50 iki 50)
    delta = Math.max(Math.min(delta, MAX_GAIN), MAX_LOSS);
    const integerDelta = Math.round(delta);
    
    // 8. Apskaičiuoti Naują Reitingą (Taikyti Nuosmukį *prieš* delta) ir paversti SVEIKAISIAIS SKAIČIAIS
    const newRating = Math.round(R_i * DecayFactor + integerDelta);
    console.log(`Runner ID: ${id}, Old Rating: ${R_i}, DecayFactor: ${DecayFactor.toFixed(3)}, Delta: ${integerDelta}, New Rating: ${newRating}`);

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
