class Reactive {
    constructor(obj) {
        this.contents = obj;
        this.objs = [obj]
        this.listeners = {};
        this.makeReactive(obj);
    }

    makeReactive(obj) {
        Object.keys(obj).forEach(prop => this.makePropReactive(obj, prop));
    }

    makePropReactive(obj, key) {
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

    listen(prop, handler) {
        if (!this.listeners[prop]) this.listeners[prop] = [];

        this.listeners[prop].push(handler);
    }

    notify(prop) {
        this.listeners[prop].forEach(listener => listener(this.contents[prop]));
    }
}

const compileToString = (template) => {
    const ast = parse(template);
    let fnStr = `\`\``;

    ast.map(t => {
        // checking to see if it is an interpolation
        if (t.startsWith("{") && t.endsWith("}")) {
            // append it to fnStr
            const uuid = t.split(/{|}/).filter(Boolean)[0].trim().split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
            fnStr = fnStr.substring(0, fnStr.length - 2) + ` data-token-${uuid}>\``;
            fnStr += `+appState.contents.${t.split(/{|}/).filter(Boolean)[0].trim()}`;
        } else {
            // append the string to the fnStr
            fnStr += `+\`${t}\``;
        }
    });

    return fnStr;
}

var parse = (template) => {
    let result = /{(.*?)}/g.exec(template);
    const arr = [];
    let firstPos;

    while (result) {
        firstPos = result.index;
        if (firstPos !== 0) {
            arr.push(template.substring(0, firstPos));
            template = template.slice(firstPos);
        }

        arr.push(result[0]);
        template = template.slice(result[0].length);
        result = /{(.*?)}/g.exec(template);
    }

    if (template) arr.push(template);
    return arr;
}

const compile = (template) => {
    return new Function("data", "return " + compileToString(template))
}

const virtualDomBody = `
<div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 max-h-3/6 border-neutral-800 rounded-lg container__count border">
            <div class="mb-2">
                <h2 class="text-xl font-semibold text-center">{count}</h2>
            </div>
            <div class="flex justify-center">
                <button d-click="appState.contents.count--" class="transition-colors p-3 active:bg-red-700 hover:bg-red-600 hover:text-zinc-100 mr-1"><svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="-5 -11 24 24"
                        width="24"
                        fill="currentColor">
                        <path d="M1 0h12a1 1 0 0 1 0 2H1a1 1 0 1 1 0-2z"></path>
                    </svg></button>
                <button d-click="appState.contents.count = 0" class="transition-colors p-3 active:bg-zinc-800 hover:bg-zinc-900 hover:text-red-100 mr-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.5 -2.5 24 24" width="24" fill="currentColor"><path d="M17.83 4.194l.42-1.377a1 1 0 1 1 1.913.585l-1.17 3.825a1 1 0 0 1-1.248.664l-3.825-1.17a1 1 0 1 1 .585-1.912l1.672.511A7.381 7.381 0 0 0 3.185 6.584l-.26.633a1 1 0 1 1-1.85-.758l.26-.633A9.381 9.381 0 0 1 17.83 4.194zM2.308 14.807l-.327 1.311a1 1 0 1 1-1.94-.484l.967-3.88a1 1 0 0 1 1.265-.716l3.828.954a1 1 0 0 1-.484 1.941l-1.786-.445a7.384 7.384 0 0 0 13.216-1.792 1 1 0 1 1 1.906.608 9.381 9.381 0 0 1-5.38 5.831 9.386 9.386 0 0 1-11.265-3.328z"></path></svg>
                </button>
                <button d-click="appState.contents.count++" class="transition-colors p-3 active:bg-green-700 hover:bg-green-600 hover:text-green-100"><svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="-4.5 -4.5 24 24"
                        width="24"
                        fill="currentColor">
                        <path d="M8.9 6.9v-5a1 1 0 1 0-2 0v5h-5a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5z">
                        </path>
                    </svg></button>
            </div>
            <br/>
            <div class="mb-2">
                <h2 class="text-xl font-semibold text-center">{count}</h2>
            </div>
        </div>
    </div>
`


const appState = new Reactive({
    count: 0,
});
// run code to compile the templated virtualDomBody into a play body
const templatedVirtualDom = eval(compileToString(virtualDomBody))

// equivalent to mounted() on svelte or vue
window.addEventListener('load', () => {
    const documentBody = document.getElementById('app')
    documentBody.innerHTML = templatedVirtualDom
    Object.keys(appState.contents).forEach((e) => {
        const querySelector = "data-token-" + e.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
        const listeningElements = document.querySelectorAll(`[${querySelector}]`)
        listeningElements.forEach((elm) => {
            appState.listen(e, (change) => elm.textContent = change);
        })
    })
    let elms = documentBody.querySelectorAll('*[d-click]')
    elms.forEach((e) => {
        const clickFunction = new Function(e.getAttribute("d-click"))
        e.addEventListener('click', () => {
            clickFunction()
        })
    })
})