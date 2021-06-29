# ns-lru

Key-Value cache with Keyv and NodeSite.eu as storage backends

### Installation

Install ns-lru using `yarn add ns-lru`

Install a [storage adapter](https://www.npmjs.com/package/keyv#official-storage-adapters)

### Usage

```typescript
import LRU from 'ns-lru';

const options = {
	namespace: 'some_namespace',
	// I suggest using a simple, alphanumerical name
	store: 'sqlite://some/local/file.db',
	// Supports any Map(), Redis, Mongo, SQLite, Postgres, MySQL,
	// Dynamo, FireStore, MSSQL, memcache, and even another ns-lru.
	ttl: 3600000,
	// How long should data be held for? (ms)
	maxSize: 1000,
	// How many items should be stored in RAM?
};

const lru = new LRU<K, V>(options);

lru.get(key: K) => Promise<V>;
lru.set(key: K, val: V) => lru;
```
