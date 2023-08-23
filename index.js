class CRDTStore {
  static shouldUpdate(existingTimestamp, incomingTimestamp) {
    return !existingTimestamp || incomingTimestamp > existingTimestamp
  }
}

class Storage {
  constructor(options = {}) {
    this.dbName = options.dbName || "ep-store"
  }

  async init(options = {}) {
    this.storageType = options.storageType || this.getDefaultStorageType()
    await this.initStorage()
  }

  getDefaultStorageType() {
    if (typeof window !== "undefined") {
      return "localStorage"
    } else {
      return "file"
    }
  }

  async initStorage() {
    switch (this.storageType) {
      case "memory":
        this.storage = MemoryStorage
        break
      case "local":
        this.storage = LocalStorage
        break
      case "idb":
        this.storage = IndexedDBStorage
        await this.storage.init(this.dbName)
        break
      case "file":
        this.storage = await FileStorage()
        break
      default:
        throw new Error("Unsupported storage type")
    }
  }

  async get(key) {
    const data = await this.storage.get(key)
    return data ? data.value : null
  }

  async set(key, value, timestamp = Date.now()) {
    await this.storage.set(key, { value, timestamp }, timestamp)
  }
}

const MemoryStorage = {
  data: {},
  get: (key) => MemoryStorage.data[key],
  set: (key, newData, timestamp) => {
    const existing = MemoryStorage.data[key]
    if (
      CRDTStore.shouldUpdate(existing ? existing.timestamp : null, timestamp)
    ) {
      MemoryStorage.data[key] = newData
    }
  },
}

const LocalStorage = {
  get: (key) => JSON.parse(localStorage.getItem(key)),
  set: (key, newData, timestamp) => {
    const existing = JSON.parse(localStorage.getItem(key))
    if (
      CRDTStore.shouldUpdate(existing ? existing.timestamp : null, timestamp)
    ) {
      localStorage.setItem(key, JSON.stringify(newData))
    }
  },
}

const IndexedDBStorage = {
  db: null,

  async init(dbName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains("keyvalue")) {
          db.createObjectStore("keyvalue")
        }
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }

      request.onerror = (event) => {
        reject("IndexedDB error: " + event.target.errorCode)
      }
    })
  },

  async get(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["keyvalue"])
      const store = transaction.objectStore("keyvalue")
      const request = store.get(key)

      request.onsuccess = (event) => {
        resolve(event.target.result)
      }

      request.onerror = (event) => {
        reject("Failed to retrieve from IndexedDB")
      }
    })
  },

  async set(key, newData, timestamp) {
    const existing = await this.get(key)
    if (
      CRDTStore.shouldUpdate(existing ? existing.timestamp : null, timestamp)
    ) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["keyvalue"], "readwrite")
        const store = transaction.objectStore("keyvalue")
        const request = store.put(newData, key)

        request.onsuccess = () => {
          resolve()
        }

        request.onerror = (event) => {
          reject("Failed to write to IndexedDB")
        }
      })
    }
  },
}

async function FileStorage() {
  if (typeof window === "undefined") {
    const fs = await import("fs/promises")
    const DEFAULT_PATH = "./ep-store.json"

    return {
      get: async (key) => {
        try {
          const dataJSON = await fs.readFile(DEFAULT_PATH, "utf-8")
          const data = JSON.parse(dataJSON)
          return data["ep-store"][key]
        } catch (e) {
          return null
        }
      },

      set: async (key, newValue, timestamp) => {
        let data = { "ep-store": {} }
        try {
          const dataJSON = await fs.readFile(DEFAULT_PATH, "utf-8")
          data = JSON.parse(dataJSON)
        } catch (e) {
          // If file doesn't exist, continue with empty data object
        }

        // CRDT logic
        const existing = data["ep-store"][key]
        if (
          CRDTStore.shouldUpdate(
            existing ? existing.timestamp : null,
            timestamp
          )
        ) {
          data["ep-store"][key] = newValue
          await fs.writeFile(
            DEFAULT_PATH,
            JSON.stringify(data, null, 4),
            "utf-8"
          )
        }
      },
    }
  } else {
    return {}
  }
}

export default Storage
