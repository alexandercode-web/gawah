export const clients = new Map()

export function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set())
  }
  clients.get(userId).add(res)
  
  res.on('close', () => {
    const userSet = clients.get(userId)
    if (userSet) {
      userSet.delete(res)
      if (userSet.size === 0) {
        clients.delete(userId)
      }
    }
  })
}

export function notifyUser(userId, event, data) {
  const userClients = clients.get(userId)
  if (userClients) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of userClients) {
      res.write(payload)
    }
  }
}
