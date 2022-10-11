import { appState } from './main';

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
    if (!isSSR()) {
        async function initClient() {
            await import('./style.css')
            const { renderPage } = await import('./lib/router/pageRenderer')
            await renderPage()
            window.onpopstate = async (e) => {
                if (e.state === null) {
                    return
                }
                await renderPage()
            }
        }
        initClient()
    } else {
        async function initSSR() {
            console.log('hydrate')
            let { hydratePage } = await import('./lib/router/hydrationManager')
            await hydratePage()
        }
        initSSR()
    }
}