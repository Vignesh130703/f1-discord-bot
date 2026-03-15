// ─────────────────────────────────────────────
//  CHANNEL: F1 HIGHLIGHTS & VIDEOS
//  • Posts NEW videos
//  • Supports both polling and webhook
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { get, fetchChannel, sleep } = require('../utils/helpers');

const F1_CHANNEL_ID = 'UCB_qr75-ydFVKSF9Dmo6izg';

const seenVideoIds = new Set();
let initialized = false;

function categorise(title) {

  if (/race edit|highlight|best moments|top 10|action|recap/i.test(title))
    return { label: '🎬 RACE HIGHLIGHTS', color: 0xE10600 };

  if (/onboard|cockpit|on-board/i.test(title))
    return { label: '🎥 ONBOARD CAM', color: 0xFF6600 };

  if (/qualifying|q1|q2|q3/i.test(title))
    return { label: '⏱️ QUALIFYING CLIP', color: 0xFFD700 };

  if (/press conference|interview/i.test(title))
    return { label: '🎙️ PRESS / INTERVIEW', color: 0x5865F2 };

  if (/sprint/i.test(title))
    return { label: '🏃 SPRINT RACE', color: 0xFF4500 };

  if (/preview|build.up|build up/i.test(title))
    return { label: '📺 WEEKEND PREVIEW', color: 0x00B9F1 };

  if (/practice|fp1|fp2|fp3/i.test(title))
    return { label: '🔧 PRACTICE SESSION', color: 0x5865F2 };

  return { label: '📹 NEW F1 VIDEO', color: 0xB00000 };
}

async function pollF1Highlights(client, channelId, ytKey) {

  if (!channelId) return;

  if (!ytKey?.trim()) {
    console.log('[HIGHLIGHTS] No YouTube API key — skipping');
    return;
  }

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  try {

    const res = await get(
      `https://www.googleapis.com/youtube/v3/search` +
      `?key=${ytKey}` +
      `&channelId=${F1_CHANNEL_ID}` +
      `&part=snippet` +
      `&order=date` +
      `&maxResults=10` +
      `&type=video`
    );

    const videos = (res?.items ?? []).reverse();

    if (!initialized) {

      for (const v of videos) {
        if (v?.id?.videoId) {
          seenVideoIds.add(v.id.videoId);
        }
      }

      initialized = true;

      console.log(
        `[HIGHLIGHTS] Initialized — seeded ${seenVideoIds.size} videos`
      );

      return;
    }

    for (const v of videos) {

      const vid = v?.id?.videoId;
      if (!vid) continue;

      if (seenVideoIds.has(vid)) continue;

      seenVideoIds.add(vid);

      const s = v.snippet;

      const pubMs = new Date(s.publishedAt).getTime();
      const pubTs = Math.floor(pubMs / 1000);

      if (Date.now() - pubMs > 48 * 60 * 60 * 1000) continue;

      const cat = categorise(s.title);

      const ytUrl = `https://www.youtube.com/watch?v=${vid}`;

      const desc =
        s.description?.slice(0, 180)?.replace(/\n/g, ' ') ?? '';

      const thumb =
        s.thumbnails?.maxres?.url ??
        s.thumbnails?.high?.url ??
        s.thumbnails?.medium?.url ??
        null;

      const embed = new EmbedBuilder()
        .setColor(cat.color)
        .setAuthor({ name: '🏎️  FORMULA 1  ·  OFFICIAL YOUTUBE' })
        .setTitle(`${cat.label}: ${s.title.slice(0, 220)}`)
        .setURL(ytUrl)
        .setDescription(
          (desc ? `> ${desc}...\n\u200B\n` : '') +
          `### 🔗 [▶️ Watch on YouTube](${ytUrl})`
        )
        .addFields(
          { name: '📅 Published', value: `<t:${pubTs}:R>`, inline: true },
          { name: '📺 Channel', value: 'Formula 1® Official', inline: true },
          { name: '🔗 Direct Link', value: ytUrl, inline: false }
        )
        .setImage(thumb)
        .setTimestamp()
        .setFooter({
          text: 'Checks every 30 min  ·  F1 Highlights Bot'
        });

      await ch.send({ embeds: [embed] });

      console.log(`[HIGHLIGHTS] Posted new video: ${s.title}`);

      await sleep(1500);
    }

  } catch (e) {

    console.error('[HIGHLIGHTS ERROR]', e.message);

  }
}

// ─────────────────────────────────────────────
//  POST SINGLE VIDEO (WEBHOOK SUPPORT)
// ─────────────────────────────────────────────

async function postSingleHighlight(client, channelId, videoId, ytKey) {

  if (!channelId || !videoId || !ytKey) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  try {

    const res = await get(
      `https://www.googleapis.com/youtube/v3/videos` +
      `?key=${ytKey}` +
      `&part=snippet` +
      `&id=${videoId}`
    );

    const v = res?.items?.[0];
    if (!v) return;

    const s = v.snippet;

    const pubMs = new Date(s.publishedAt).getTime();
    const pubTs = Math.floor(pubMs / 1000);

    const cat = categorise(s.title);

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const desc =
      s.description?.slice(0, 180)?.replace(/\n/g, ' ') ?? '';

    const thumb =
      s.thumbnails?.maxres?.url ??
      s.thumbnails?.high?.url ??
      s.thumbnails?.medium?.url ??
      null;

    const embed = new EmbedBuilder()
      .setColor(cat.color)
      .setAuthor({ name: '🏎️  FORMULA 1  ·  OFFICIAL YOUTUBE' })
      .setTitle(`${cat.label}: ${s.title.slice(0, 220)}`)
      .setURL(ytUrl)
      .setDescription(
        (desc ? `> ${desc}...\n\u200B\n` : '') +
        `### 🔗 [▶️ Watch on YouTube](${ytUrl})`
      )
      .addFields(
        { name: '📅 Published', value: `<t:${pubTs}:R>`, inline: true },
        { name: '📺 Channel', value: 'Formula 1® Official', inline: true },
        { name: '🔗 Direct Link', value: ytUrl, inline: false }
      )
      .setImage(thumb)
      .setTimestamp()
      .setFooter({
        text: 'F1 Highlights Bot'
      });

    await ch.send({ embeds: [embed] });

    console.log(`[HIGHLIGHTS] Webhook posted video: ${s.title}`);

  } catch (e) {

    console.error('[HIGHLIGHTS WEBHOOK ERROR]', e.message);

  }

}

module.exports = { pollF1Highlights, postSingleHighlight };