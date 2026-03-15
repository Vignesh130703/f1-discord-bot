<div align="center">

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/2560px-F1.svg.png" width="200px" alt="F1 Logo"/>

# 🏎️ F1 Discord Bot

**A fully automated Formula 1 intelligence bot for Discord.**
Real-time standings, race alerts, live timetables & highlights — all in one server.

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Railway](https://img.shields.io/badge/Deployed%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![License](https://img.shields.io/badge/License-MIT-E10600?style=for-the-badge)](LICENSE)

<br/>

> *Turns your Discord server into a live F1 command center.*

</div>

---

## ⚡ What It Does

The bot watches Formula 1 data 24/7 and automatically keeps your Discord server up to date — no manual intervention needed. Every channel always shows **one clean, edited message** that updates in place instead of spamming new ones.

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🏆 Driver Standings
Live FIA-style championship table with points, gaps, wins and nationality flags. Auto-updates after every race result.

### 🏗️ Constructor Standings
Full team championship table with colored team dots. Refreshes whenever race data changes.

### 📅 Race Calendar
Complete season timetable showing all rounds, circuits, dates and completion status.

### 🏎️ Next Race Info
Dedicated channel with countdown, circuit stats, weather forecast and track map. Updates hourly on race weekends.

</td>
<td width="50%">

### 📻 Session Alerts
Automated reminders posted 1 hour before every practice, qualifying, sprint and race session.

### 🏟️ Race Weekend Mode
Activates when a race week begins (≤5 days out) with full weekend schedule and session status.

### 🎬 Highlights
Monitors YouTube for new official F1 highlight videos and posts them automatically every 30 minutes.

### 🤖 Bot Status Dashboard
Live system health panel showing uptime, task status, last run times, API health and error tracking.

</td>
</tr>
</table>

---

## 📸 Channel Preview

```
┌─────────────────────────────────────────────────┐
│  🏆 DRIVERS CHAMPIONSHIP STANDINGS              │
│  ─────────────────────────────────────────────  │
│  🥇 🇳🇱 Max Verstappen      RB  429  LEADER   16 │
│  🥈 🇬🇧 Lando Norris        MC  374   +55    6  │
│  🥉 🇬🇧 George Russell      MB  350   +79    5  │
│  4.  🇦🇺 Oscar Piastri       MC  314  +115    2  │
│  5.  🇲🇽 Sergio Perez        RB  285  +144    0  │
│                  ⏱ Updated 2 minutes ago         │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js 18+** | Runtime |
| **Discord.js v14** | Discord API |
| **node-cron** | Scheduled tasks |
| **Axios** | HTTP requests |
| **Jolpica / Ergast API** | F1 data |
| **YouTube Data API v3** | Highlights |
| **Railway** | Cloud hosting |

---

## 📁 Project Structure

```
f1bot/
├── channels/
│   ├── driverStandings.js      # Driver championship embed
│   ├── constructorStandings.js # Constructor championship embed
│   ├── timetable.js            # Season race calendar
│   ├── nextRace.js             # Next race info + weather
│   ├── alerts.js               # Pre-session reminders
│   ├── raceWeekend.js          # Race week activation
│   ├── highlights.js           # YouTube highlights poller
│   ├── botStatus.js            # System health dashboard
│   ├── logger.js               # Bot activity log channel
│   └── slashCommands.js        # Slash command handler
├── utils/
│   ├── updateMessage.js        # Edit-or-resend message logic
│   ├── messageStore.js         # Persistent message ID store
│   ├── helpers.js              # Shared utilities + API calls
│   ├── sessionStatus.js        # Session state tracker
│   └── raceResultWatcher.js    # New race result detection
├── index.js                    # Entry point + cron scheduler
├── register-commands.js        # Slash command registration
└── railway.json                # Railway deployment config
```

---

## 🔧 Setup & Deployment

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/f1bot.git
cd f1bot
npm install
```

### 2. Create `.env` file
```env
DISCORD_TOKEN=your_bot_token

CLIENT_ID=your_application_id
GUILD_ID=your_server_id

CHANNEL_DRIVER_STANDINGS=channel_id
CHANNEL_CONSTRUCTOR_STANDINGS=channel_id
CHANNEL_TIMETABLE=channel_id
CHANNEL_NEXT_RACE=channel_id
CHANNEL_ALERTS=channel_id
CHANNEL_RACE_WEEKEND=channel_id
CHANNEL_HIGHLIGHTS=channel_id
CHANNEL_BOT_STATUS=channel_id
CHANNEL_LOG=channel_id

YOUTUBE_API_KEY=your_youtube_api_key
```

### 3. Register slash commands *(first time only)*
```bash
npm run register
```

### 4. Run locally
```bash
npm start
```

### 5. Deploy to Railway
1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Add all `.env` variables in the **Variables** tab
4. Railway auto-deploys — bot is live in ~1 minute ✅

---

## 💬 Slash Commands

| Command | Description |
|---|---|
| `/standings` | Post driver championship standings |
| `/constructors` | Post constructor championship standings |
| `/timetable` | Post full season race calendar |
| `/nextrace` | Post next race info with countdown |
| `/highlights` | Check for new F1 YouTube videos |
| `/status` | Show bot system health dashboard |
| `/profile [driver]` | Driver profile for current season |
| `/h2h [driver1] [driver2]` | Head-to-head driver comparison |
| `/seasonstats` | Season wins, poles & fastest laps |
| `/hof` | F1 Hall of Fame — all World Champions |
| `/test` | Send a test message to every channel |

---

## ⏱️ Update Schedule

| Channel | Trigger |
|---|---|
| Driver Standings | After each race result detected |
| Constructor Standings | After each race result detected |
| Race Calendar | After each race result detected |
| Next Race | Every hour on Fri / Sat / Sun |
| Session Alerts | 1 hour before each session |
| Race Weekend | When race week begins (≤5 days out) |
| Highlights | Every 30 minutes |
| Bot Status | Every 30 minutes |

---

## 🔑 Getting Your Discord Credentials

| Value | Where to find it |
|---|---|
| `DISCORD_TOKEN` | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token |
| `CLIENT_ID` | Developer Portal → Your App → General Information → Application ID |
| `GUILD_ID` | Discord → Enable Developer Mode → Right-click server → Copy Server ID |
| Channel IDs | Enable Developer Mode → Right-click channel → Copy Channel ID |

---

## 📜 License

MIT — free to use, modify and deploy.

---

<div align="center">

Built with ❤️ for the F1 community

**🏁 Lights out and away we go! 🏁**

</div>