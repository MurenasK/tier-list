export function calculateElo(runners, results, kFactor = 32)
{
    let updated = { ...runners };

    for (let i = 0; i < results.length; i++)
    {
        for (let j = i + 1; j < results.length; j++)
        {
            const winner = results[i];
            const loser = results[j];

            const Ra = updated[winner].rating;
            const Rb = updated[loser].rating;

            const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
            const Eb = 1 - Ea

            updated[winner].rating = Ra + kFactor * (1 - Ea);
            updated[loser].rating = Rb + kFactor * (0 - Eb);
        }
    }
    return updated;
}