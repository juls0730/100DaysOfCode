import { renderPage, hydratePage } from './lib/router';
import { isSSR, appState } from '/src/main';

export async function mount(mounted) {
    eval(mounted)
}

if (!import.meta.env.SSR) {
    // waits for the page to fully load to render the page from the virtDOM
    if (document.getElementById('app').childNodes.length == 1) {
        await import('/src/style.css')
        await renderPage()
        window.onpopstate = async () => {
            await renderPage()
        }
    } else {
        hydratePage()
    }
}