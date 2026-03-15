const fs = require("fs")

const FILE = "./messageStore.json"

function loadStore() {
  if (!fs.existsSync(FILE)) {
    return {}
  }

  try {
    const data = fs.readFileSync(FILE)
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function saveStore(store) {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2))
}

module.exports = { loadStore, saveStore }