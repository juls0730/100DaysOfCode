export class Reactive {
	listeners: Record<string, Array<CallableFunction>>;
	contents: Record<string, unknown>;

	constructor(obj: Record<string, unknown>) {
		const createProxy = (target: unknown, propName: string) => {
			if (propName !== '') {
				propName = propName + '.';
			}
			function proxyObjects(obj: Record<string, unknown>) {
				if (typeof obj !== 'object') {
					return;
				}

				Object.keys(obj).forEach((key) => {
					if (typeof obj[key] == 'object') {
						proxyObjects(obj[key]);
						obj[key] = createProxy(obj[key], `${propName}${key}`);
					}
				});
			}

			proxyObjects(target);

			return new Proxy(target, {
				set: (target, key, value) => {
					if (typeof value === 'object') {
						// Recursively create a proxy for nested objects
						value = createProxy(value, `${propName}${key.toString()}`);
					}

					if (typeof key !== 'string') return false;

					target[key] = value;
					this.notify(`${propName}${key}`);
					return true;
				},
			});
		};

		this.contents = createProxy(obj, '');
		this.listeners = {};
	}

	listen(prop: string, handler: CallableFunction) {
		if (!this.listeners[prop]) this.listeners[prop] = [];

		this.listeners[prop]?.push(handler);
	}

	notify(prop: string) {
		if (!this.listeners[prop]) return;

		// Split the property name into its nested parts
		const propParts = prop.split('.');

		// Get the value of the nested property on the contents object
		let value: unknown = this.contents;
		propParts.forEach((part) => {
			value = value[part];
		});

		this.listeners[prop]?.forEach((listener: CallableFunction) => listener(value));
	}
}