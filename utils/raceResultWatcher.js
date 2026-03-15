// ─────────────────────────────────────────────
//  AUTO RACE RESULT DETECTOR
//  • Detects when a race finishes
//  • Triggers standings + calendar updates
// ─────────────────────────────────────────────

const { ERGAST, get } = require('../utils/helpers');

let lastProcessedRace = null;

async function checkRaceResults(client, CHANNELS) {

  try {

    const data = await get(`${ERGAST}/current/last/results.json`);

    const race = data?.MRData?.RaceTable?.Races?.[0];

    if (!race) return;

    const raceId = `${race.season}-${race.round}`;

    // prevent duplicate processing
    if (raceId === lastProcessedRace) return;

    lastProcessedRace = raceId;

    console.log(`[RESULT DETECTED] ${race.raceName}`);

    const { postDriverStandings } = require('./driverStandings');
    const { postConstructorStandings } = require('./constructorStandings');
    const { postTimetable } = require('./timetable');

    // update channels
    await postDriverStandings(client, CHANNELS.DRIVER_STANDINGS);
    await postConstructorStandings(client, CHANNELS.CONSTRUCTOR_STANDINGS);
    await postTimetable(client, CHANNELS.TIMETABLE);

  } catch (err) {

    console.error('[RACE WATCHER]', err.message);

  }

}

module.exports = { checkRaceResults };