import { Reactive } from './lib/ReactiveObject';
import { getCookie } from './lib/cookieManager';

export const appState: Reactive = new Reactive({
	count: 0,
	text: '',
	cookie: getCookie('username'),
	html: '',
	year: '',
	cookiedata: '',
});

console.log(getCookie('username'));

let SSR: boolean;

export function isSSR() {
	if (!import.meta.env.SSR) {
		if (SSR !== undefined) return SSR;
		SSR = !!document.getElementById('app')?.getAttribute('data-server-rendered');
		return SSR;
	}
}