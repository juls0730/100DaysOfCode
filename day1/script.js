function getTrackableObject(obj, callback) {
    if (obj[Symbol.for('isTracked')]) return obj;
    const tracked = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        Object.defineProperty(tracked, key, {
            configurable: true,
            enumerable: true,
            get() {
                return obj[key];
            },
            set(value) {
                if (typeof value === 'object') {
                    value = getTrackableObject(value);
                }
                obj[key] = value;
                callback(obj);
                console.log(`'${key}' has changed. ` + obj[key]);
            },
        });
    }
    // marked as 'tracked'
    Object.defineProperty(tracked, Symbol.for('isTracked'), {
        configurable: false,
        enumerable: false,
        value: true,
    });
    return tracked;
}

const countElm = document.getElementById('count')
countElm.textContent = 0
// track app state
const appState = getTrackableObject({ count: 0 }, (obj) => countElm.textContent = obj.count);
// appState.count = appState.count + 1; // log `'foo' has changed.`

document.getElementById('btn-subtract').addEventListener('click', () => {
    appState.count--;
})
document.getElementById('btn-reset').addEventListener('click', () => {
    appState.count = 0;
})
document.getElementById('btn-add').addEventListener('click', () => {
    appState.count++;
})