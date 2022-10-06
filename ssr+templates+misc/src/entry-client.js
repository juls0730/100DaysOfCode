import { Reactive } from './lib/ReactiveObject'
import { renderPage, hydratePage } from './lib/router';
import { getCookie } from './lib/cookieManager';
import { isSSR } from '/src/main';
import '/src/style.css';

export const appState = new Reactive({
    count: 0,
    cookie: getCookie('username'),
    text: '',
    html: '',
    year: '',
    cookiedata: "",
    jsonData: { 'data': 'e' }
});

export async function mount(mounted) {
    eval(mounted)
}

if (!import.meta.env.SSR) {
    // waits for the page to fully load to render the page from the virtDOM
    if (!isSSR) {
        await renderPage()
        window.onpopstate = async () => {
            await renderPage()
        }
    } else {
        hydratePage()
    }
}