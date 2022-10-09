import { renderPage, hydratePage } from './lib/router';
import { appState } from '/src/main';

export async function mount(mounted) {
    eval(mounted)
}

let SSR

export function isSSR() {
    if (!import.meta.env.SSR) {
        if (SSR !== undefined) return SSR
        if (document.getElementById('app').childNodes[1].childNodes.length == null) {
            SSR = false
        } else {
            SSR = document.getElementById('app').childNodes[1].childNodes.length > 0
        }
        return SSR
    }
}

if (!import.meta.env.SSR) {
    // waits for the page to fully load to render the page from the virtDOM
    console.log(document.getElementById('app').childNodes[1].childNodes.length > 0)
    if (!document.getElementById('app').childNodes[1].childNodes.length > 0) {
        await import('/src/style.css')
        await renderPage()
        window.onpopstate = async () => {
            await renderPage()
        }
    } else {
        hydratePage()
    }
}