export class Reactive {
    [x: string]: any;
    constructor(obj: any) {
        this.contents = obj;
        this.listeners = {};
        this.makeReactive(obj);
    }

    makeReactive(obj: any) {
        Object.keys(obj).forEach(prop => this.makePropReactive(obj, prop));
    }

    makePropReactive(obj: any, key: string) {
        let value = obj[key];

        // Gotta be careful with this here
        const that = this;

        Object.defineProperty(obj, key, {
            get() {
                return value;
            },
            set(newValue) {
                value = newValue;
                that.notify(key)
            }
        })
    }

    listen(prop: any, handler: any) {
        if (!this.listeners[prop]) this.listeners[prop] = [];

        this.listeners[prop].push(handler);
    }

    notify(prop: any) {
        if (!this.listeners[prop]) return
        this.listeners[prop].forEach((listener: (arg0: any) => any) => listener(this.contents[prop]));
    }
}