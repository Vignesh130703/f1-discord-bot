// ─────────────────────────────────────────────
//  SESSION STATUS HELPER
//  Detects LIVE / COMPLETED / UPCOMING
// ─────────────────────────────────────────────

function getSessionStatus(sessionTimestamp, durationMs = 2 * 60 * 60 * 1000) {

  const now = Date.now();
  const start = sessionTimestamp * 1000;
  const end = start + durationMs;

  if (now > end) {
    return {
      status: 'completed',
      icon: '✅',
      label: 'Completed'
    };
  }

  if (now >= start && now <= end) {
    return {
      status: 'live',
      icon: '🔴',
      label: 'LIVE NOW'
    };
  }

  return {
    status: 'upcoming',
    icon: '⏳',
    label: 'Upcoming'
  };
}

module.exports = { getSessionStatus };