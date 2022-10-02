import { Reactive } from './lib/ReactiveObject'
import { renderPage, hydratePage } from './lib/router';
import { getCookie } from './lib/cookieManager';
import '/src/style.css';

export const appState = new Reactive({
    count: 0,
    cookie: getCookie('username'),
    text: '<img src="x" onerror="alert(1)" />',
    html: '',
    year: '',
    cookiedata: "",
});

// waits for the page to fully load to render the page from the virtDOM
window.addEventListener('load', async () => {
    // loadPage after all the index is loaded
    if (!import.meta.env.SSR) {
        await renderPage()
      } else {
        await hydratePage()
      }
    window.onpopstate = async () => {
        await renderPage()
    }
})