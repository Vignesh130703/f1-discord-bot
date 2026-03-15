const { fetchChannel } = require('./helpers')

const messageStore = new Map()

async function updateMessage(client, channelId, payload) {

  if (!channelId) return

  const ch = await fetchChannel(client, channelId)
  if (!ch) return

  const existing = messageStore.get(channelId)

  if (existing) {
    try {
      await existing.edit(payload)
      return
    } catch {
      messageStore.delete(channelId)
    }
  }

  const msg = await ch.send(payload)

  messageStore.set(channelId, msg)

}

module.exports = { updateMessage }