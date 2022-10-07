import { Reactive } from './lib/ReactiveObject'
import { getCookie } from './lib/cookieManager';

export const appState = new Reactive({
    count: 0,
    cookie: getCookie('username'),
    text: '',
    html: '',
    year: '',
    cookiedata: "",
});

let SSR = false;

export function isSSR() {
    return SSR;
}

export function setSSR() {
    SSR = true;
}