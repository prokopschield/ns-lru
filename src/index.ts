import Keyv from 'keyv';
import nsblob from 'nsblob';
import QuickLRU from 'quick-lru';

const size_limit_nsblob = nsblob.config.num.file_size_limit;

export class LRU<V>
	implements Map<string, V | Promise<V | string | Buffer | undefined>>
{
	constructor(
		options: {
			/** Namespace for the current instance. */
			namespace?: string;
			/** A custom serialization function. */
			serialize?: (data: V) => string;
			/** A custom deserialization function. */
			deserialize?: (data: string) => V;
			/** The connection string URI. */
			uri?: string;
			/** The storage adapter instance to be used by Keyv. */
			store?: {
				get(key: string): V | Promise<V | undefined> | undefined;
				set(key: string, value: V, ttl?: number): any;
				delete(key: string): boolean | Promise<boolean>;
				clear(): void | Promise<void>;
			};
			/** Default TTL. Can be overridden by specififying a TTL on `.set()`. */
			ttl?: number;
			/** Specify an adapter to use. e.g `'redis'` or `'mongodb'`. */
			adapter?:
				| 'redis'
				| 'mongodb'
				| 'mongo'
				| 'sqlite'
				| 'postgresql'
				| 'postgres'
				| 'mysql';
			/** Specify the number of items to be stored in RAM */
			maxSize: number;
		} = {
			maxSize: 1,
		}
	) {
		this._cache = new QuickLRU<string, V>({
			maxSize: options.maxSize || 1,
			onEviction: (key, val) => this._evicted(key, val),
		});
		this._store = new Keyv<V>(options);
	}

	private _tmp = new Map<string, V>();
	private _cache: QuickLRU<string, V>;
	private _store: Keyv<V | string>;
	private async _evicted(key: string, val: V) {
		this._tmp.set(key, val);
		let _val = val;
		if (_val instanceof Promise) {
			_val = await _val;
		}
		if (_val instanceof Uint8Array && _val.length > 4096) {
			if (_val.length > size_limit_nsblob) {
				// Item is too large.
				// Discard it =(
				return;
			}
			const stored = await nsblob.store(Buffer.from(_val));
			this._store.set(key, `:nsblob:${stored}`);
			return;
		}
		this._store
			.set(key, _val)
			.then(() => val === this._tmp.get(key) && this._tmp.delete(key));
	}

	/**
	 * Delete everything, both RAM and storage.
	 */
	public clear(): void {
		this._cache.clear();
		this._store.clear();
	}

	/**
	 * Delete key-value pair from RAM and storage
	 */
	public delete(key: string): boolean {
		this._cache.delete(key);
		this._store.delete(`${key}`);
		return true;
	}

	/**
	 * Calls callback for each entry in RAM
	 */
	public forEach(
		callbackfn: (value: V, key: string, map: LRU<V>) => void,
		thisArg?: any
	): void {
		for (const [key, value] of this._cache) {
			callbackfn.call(thisArg || this, value, key, this);
		}
	}

	/**
	 * Get value by key
	 */
	public async get(key: string): Promise<V | Buffer | string | undefined> {
		let val =
			this._cache.get(key) ??
			this._tmp.get(key) ??
			(await this._store.get(`${key}`));
		if (typeof val === 'string' && val.match(/^\:nsblob\:[a-f0-9]{64}$/)) {
			return nsblob.fetch(val.substr(8));
		} else return val;
	}

	/**
	 * Is key-value in RAM?
	 */
	public has(key: string): boolean {
		return this._cache.has(key);
	}

	/**
	 * Is key-value pair in either RAM or storage?
	 */
	public async hasStored(key: string): Promise<boolean> {
		return this._cache.has(key) || !!(await this._store.get(`${key}`));
	}

	/**
	 * Set a key-value pair
	 */
	public set(key: string | number, value: V): this {
		this._cache.set(`${key}`, value);
		return this;
	}

	/**
	 * Gets the number of items stored in RAM
	 */
	get size(): number {
		return this._cache.size;
	}

	/**
	 * Returns an iterable of entries in the map.
	 */
	*[Symbol.iterator](): IterableIterator<[string, V]> {
		return this.entries();
	}

	/**
	 * Returns an iterable of key, value pairs for every entry in the map.
	 */
	*entries() {
		for (const kvp of this._cache) {
			yield kvp;
		}
	}

	/**
	 * Returns an iterable of keys in the map
	 */
	*keys() {
		for (const [key] of this._cache) {
			yield key;
		}
	}

	/**
	 * Returns an iterable of values in the map
	 */
	*values() {
		for (const [, val] of this._cache) {
			yield val;
		}
	}
	[Symbol.toStringTag] = 'ns-lru';
}

export default LRU;
module.exports = LRU;

Object.assign(LRU, {
	default: LRU,
	LRU,
});
