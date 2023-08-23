import Storage from "./index.js"

const db = new Storage()
await db.init({ storageType: "file" /** "memory" || "local" || "idb" */ })
await db.set("key1", "value1")
await db.set("key2", { subkey1: "value1" })
let graph = await db.get("key2")
console.log(graph)
