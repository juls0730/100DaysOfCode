import { renderPage, hydratePage } from './lib/router';
import { isSSR, appState } from '/src/main';

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