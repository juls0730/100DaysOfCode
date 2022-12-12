// ruthlessly stolen from @trunarla on twitter
export class LRUCache {
	#cache: Map<string, string | Record<string, string | Record<string, string | boolean>>>;
	#capacity: number;

	constructor(capacity: number) {
		this.#capacity = capacity;
		this.#cache = new Map<string, string | Record<string, string | Record<string, string | boolean>>>();
	}

	set(key: string, value: string | Record<string, string | Record<string, string | boolean>>) {
		// If we're at capacity, we need to delete the least-recently-used item:
		if (this.#cache.size >= this.#capacity) {
			// Manually invoke the keys iterator to get the least-recently-used key:
			const keyToDelete = this.#cache.keys().next().value;
			this.#cache.delete(keyToDelete);
		}
		this.#cache.delete(key);
		this.#cache.set(key, value);
	}

	get(key: string): Record<string, string | Record<string, string | boolean>> | string | undefined {
		if (this.#cache.has(key)) {
			const value = this.#cache.get(key);
			if (!value) return;
			this.#cache.delete(key);
			this.#cache.set(key, value);
			return value;
		}
	}
}