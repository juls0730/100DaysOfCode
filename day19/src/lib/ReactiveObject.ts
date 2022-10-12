export class Reactive {
	listeners: any;
	contents: any;
	constructor(obj: Record<string, unknown>) {
		this.contents = obj;
		this.listeners = {};
		this.makeReactive(obj);
	}

	makeReactive(obj: Record<string, unknown>) {
		Object.keys(obj).forEach(prop => this.makePropReactive(obj, prop));
	}

	makePropReactive(obj: Record<string, unknown>, key: string) {
		let value = obj[key];

		// Gotta be careful with this here
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;

		Object.defineProperty(obj, key, {
			get() {
				return value;
			},
			set(newValue) {
				value = newValue;
				that.notify(key);
			}
		});
	}

	listen(prop: string, handler: any) {
		if (!this.listeners[prop]) this.listeners[prop] = [];

		this.listeners[prop].push(handler);
	}

	notify(prop: string) {
		if (!this.listeners[prop]) return;
		this.listeners[prop].forEach((listener: any) => listener(this.contents[prop]));
	}
}