# Easypeers-store
> Easypeers storage

Easypeers-store is a basic graph database with CRDT that works in node and the browser with zero dependencies. It has basic support for an in-memory store, localStorage, indexedDb and file-based storage when using node.

# Usage
## Browser
```html
<script src="" type="module"> ... </script>
```

## Node

```js
import Storage from 'easypeers-store'
```

```js
const db = new Storage()
await db.init({ storageType: "file" /** "memory" || "local" || "idb" */ })
await db.set("key1", "value1")
await db.set("key2", { subkey1: "value1" })
let graph = await db.get("key2")
console.log(graph)
```