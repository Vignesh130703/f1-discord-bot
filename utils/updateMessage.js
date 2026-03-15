const { loadStore, saveStore } = require("./messageStore")

async function updateMessage(client, channelId, key, payload) {

  const store = loadStore()

  const channel = await client.channels.fetch(channelId)

  if (!channel) return

  // 1. Try to edit the stored message — ideal path
  if (store[key]) {
    try {
      const existing = await channel.messages.fetch(store[key])
      await existing.edit(payload)
      return
    } catch (err) {
      console.log(`[updateMessage] Stored message for "${key}" not found or not editable. Will clean up and resend.`)
      delete store[key]
      saveStore(store)
    }
  }

  // 2. Stored message gone — delete ALL bot messages in this channel to avoid pile-up
  try {
    const fetched = await channel.messages.fetch({ limit: 100 })
    const botMessages = fetched.filter(m => m.author.id === client.user.id)
    for (const [, msg] of botMessages) {
      try { await msg.delete() } catch {}
    }
  } catch (err) {
    console.log(`[updateMessage] Could not clean up old messages in "${key}" channel:`, err.message)
  }

  // 3. Send fresh message and save its ID
  const message = await channel.send(payload)
  store[key] = message.id
  saveStore(store)

}

module.exports = updateMessage