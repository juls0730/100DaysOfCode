import { renderPage, hydratePage } from './lib/router';
import { appState } from '/src/main';

export async function mount(mounted) {
    eval(mounted)
}

let SSR

export function isSSR() {
    if (!import.meta.env.SSR) {
        if (SSR !== undefined) return SSR
        SSR = true;
        document.head.childNodes.forEach((e) => {
            if (e.nodeName == '#comment' && e.textContent == `style-outlet`) {
              SSR = false
            }
        })
        return SSR
    }
}

if (!import.meta.env.SSR) {
    // waits for the page to fully load to render the page from the virtDOM
    if (!isSSR()) {
        await import('/src/style.css')
        await renderPage()
        window.onpopstate = async (e) => {
            if (e.state === null) {
                return
            }
            await renderPage()
        }
    } else {
        hydratePage()
    }
}