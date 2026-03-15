const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag } = require('../utils/helpers');
const { loadStore, saveStore } = require('../utils/messageStore');

const sentAlerts = new Set();

const SESSION_THEME = {
  FP1:        { emoji: '🔧', color: 0x5865F2, label: 'FREE PRACTICE 1',  tip: 'Watch for setup changes and tyre evaluations.' },
  FP2:        { emoji: '🔧', color: 0x5865F2, label: 'FREE PRACTICE 2',  tip: 'Long-run pace data will be key today.' },
  FP3:        { emoji: '🔧', color: 0x5865F2, label: 'FREE PRACTICE 3',  tip: 'Final tune-up before qualifying — watch sector times!' },
  QUALIFYING: { emoji: '⏱️', color: 0xFFD700, label: 'QUALIFYING',        tip: 'Q1 → Q2 → Q3. Track position is everything!' },
  SPRINT:     { emoji: '🏃', color: 0xFF6600, label: 'SPRINT RACE',       tip: '100 km flat-out — no mandatory pit stop.' },
  RACE:       { emoji: '🏁', color: 0xE10600, label: 'GRAND PRIX RACE',   tip: 'Lights out and away we go! 🔥' },
};

// Three alert windows per session
const ALERT_WINDOWS = [
  { mins: 60, label: '1 HOUR'      },
  { mins: 30, label: '30 MINUTES'  },
  { mins: 5,  label: '5 MINUTES'   },
];

async function checkSessionAlerts(client, channelId) {
  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const data = await get(`${ERGAST}/current/next.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return;

  const sessions = [
    { key: 'FP1',        date: race.FirstPractice  },
    { key: 'FP2',        date: race.SecondPractice },
    { key: 'FP3',        date: race.ThirdPractice  },
    { key: 'QUALIFYING', date: race.Qualifying     },
    { key: 'SPRINT',     date: race.Sprint         },
    { key: 'RACE',       date: { date: race.date, time: race.time } },
  ];

  const now   = Date.now();
  const cFlag = flag(race.Circuit.Location.country);

  for (const s of sessions) {
    if (!s.date) continue;

    const st       = new Date(`${s.date.date}T${s.date.time ?? '00:00:00Z'}`).getTime();
    const diffMins = (st - now) / 60000;

    // Find matching alert window (±1 min tolerance)
    const window = ALERT_WINDOWS.find(w => diffMins >= w.mins - 1 && diffMins < w.mins + 1);
    if (!window) continue;

    const alertKey = `${race.round}-${s.key}-${window.mins}`;
    if (sentAlerts.has(alertKey)) continue;
    sentAlerts.add(alertKey);

    const theme = SESSION_THEME[s.key];
    const tss   = Math.floor(st / 1000);

    const embed = new EmbedBuilder()
      .setColor(theme.color)
      .setAuthor({ name: `🏎️  F1 SESSION ALERT  ·  ${race.raceName}` })
      .setTitle(`${theme.emoji}  ${theme.label} — STARTS IN ${window.label}!`)
      .setDescription(
        `${cFlag} **${race.raceName}**\n` +
        `> 📍 ${race.Circuit.circuitName}\n` +
        `> 🔢 Round **${race.round}**  ·  **${data.MRData.RaceTable.season}** Season\n\u200B`
      )
      .addFields(
        { name: '🕐  Session Time', value: `<t:${tss}:F>`, inline: true },
        { name: '⏱️  Countdown',    value: `<t:${tss}:R>`, inline: true },
        { name: '💡  Tip',          value: theme.tip }
      )
      .setTimestamp()
      .setFooter({ text: `${window.label} warning · F1 Bot Session Alerts` });

    const payload = {
      content: `@everyone\n\n${theme.emoji} **${theme.label}** starts in **${window.label}**!`,
      embeds: [embed],
    };

    // Edit same message per session (no flood of new messages)
    const store    = loadStore();
    const storeKey = `alert-${race.round}-${s.key}`;

    if (store[storeKey]) {
      try {
        const existing = await ch.messages.fetch(store[storeKey]);
        await existing.edit(payload);
      } catch {
        const msg = await ch.send(payload);
        store[storeKey] = msg.id;
        saveStore(store);
      }
    } else {
      const msg = await ch.send(payload);
      store[storeKey] = msg.id;
      saveStore(store);
    }

    // Log ONLY when alert actually fires — not every cron tick
    const { logAction } = require('./logger');
    await logAction(
      `🔔 **Alert sent** — ${theme.label}`,
      `${window.label} warning · ${race.raceName}`
    );

    console.log(`[Alert] ${theme.label} — ${window.label} sent`);
  }
}

module.exports = { checkSessionAlerts };