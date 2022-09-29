import { Reactive } from './lib/ReactiveObject'
import { loadPage, hydratePage } from './lib/router';
import { getCookie } from './lib/cookieManager';
import '/src/style.css';

export const appState = new Reactive({
    count: 0,
    cookie: getCookie('username'),
    text: '',
    year: '',
    cookiedata: ""
});

// equivalent to mounted() on svelte or vue
window.addEventListener('load', async () => {
    // loadPage after all the index is loaded
    if (!import.meta.env.SSR) {
        await loadPage()
      } else {
        await hydratePage()
      }
    window.onpopstate = async () => {
        await loadPage()
    }
})