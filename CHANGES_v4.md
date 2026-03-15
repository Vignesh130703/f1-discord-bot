# F1 Bot v4 — Changes Summary

## 🔧 Cron Overhaul
- **No more daily updates** — cron only fires when needed
- Race result check runs every 5 min **on race weekends only**, and only updates channels when a **new result is detected**
- Standings / timetable / nextRace update once **3 hours after the race countdown ends** (not on a timer)
- `raceWeekend` posts once per race week (Monday 6 AM trigger), not every 3 hrs
- After each session (FP/Qualifying/Sprint/Race) ends, `nextRace` + `raceWeekend` auto-update once 3 hrs later

## 🔔 Race Alerts
- Alerts fire at **60 minutes**, **30 minutes**, and **5 minutes** before each session
- All three warnings **edit the same message** (no three separate messages)
- Every alert pings `@everyone`

## 🤖 Bot Status
- Discord presence is always **🔴 LIVE · Formula 1** (Watching status)

## 📋 Log Channel
- All cron task results within a 1-minute window are **batched into ONE embed**
- Dead channel alerts are reported in **ONE message** listing all down channels, mentioning the bot owner
- Add `OWNER_USER_ID=your_discord_user_id` to `.env` so alerts tag you

## ⌨️ /update Command (Server-Wise)
- New `/update` slash command
- Run it **inside any managed F1 channel** and it will update ONLY that channel
- e.g. run `/update` in `#f1-standings` → updates driver standings only
- e.g. run `/update` in `#f1-timetable` → updates timetable only
- If run in a non-bot channel, returns an error

## 🗺️ Files Changed
- `index.js` — full rewrite with smart cron, post-session triggers, batch logging
- `channels/alerts.js` — 60/30/5 min alerts, single editable message
- `channels/logger.js` — batched log embeds, single dead-channel message
- `channels/raceWeekend.js` — posts once per week, updates in-place
- `channels/slashCommands.js` — added server-wise /update
- `register-commands.js` — added /update command registration
- `.env` — added OWNER_USER_ID variable

## 💡 Enhancement Suggestions
1. **F1 Trivia Bot** — `/trivia` command with F1 knowledge questions
2. **Race Prediction Game** — users predict podium before race; auto-scores after
3. **Driver of the Day Poll** — auto-posts after each race, users vote
4. **Live Lap Counter** — shows current lap during race in live position channel
5. **Pit Stop Alerts** — track pitstop events via OpenF1 API during race
6. **Head-to-Head Streak Tracker** — running tally of teammate battles each season
7. **Weather Watch** — send alert if rain is forecast for qualifying/race day
8. **Fantasy Points** — simple leaderboard for fan fantasy predictions
9. **Push Notifications via DM** — let users opt-in to DM alerts instead of @everyone
10. **Multi-Server Support** — store per-guild config in SQLite so the bot can serve multiple servers
