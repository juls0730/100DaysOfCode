export class Reactive {
	listeners: Record<string, Array<CallableFunction>>;
	contents: Record<string, unknown>;

	constructor(obj: Record<string, unknown>) {
		this.contents = new Proxy(obj, {
			set: (target, key, value) => {
				target[key] = value;
				this.notify(key);
				return true;
			},
		});
		this.listeners = {};
	}

	listen(prop: string, handler: CallableFunction) {
		if (!this.listeners[prop]) this.listeners[prop] = [];

		this.listeners[prop]?.push(handler);
	}

	notify(prop: string) {
		if (!this.listeners[prop]) return;
		this.listeners[prop]?.forEach((listener: CallableFunction) => listener(this.contents[prop]));
	}
}