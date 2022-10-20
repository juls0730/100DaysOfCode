import { Reactive } from './lib/ReactiveObject';

export const appState: Reactive = new Reactive({
	count: 0,
	text: '',
	cookie: '',
	html: '',
	year: '',
	cookiedata: '',
});

let SSR: boolean;

export function isSSR() {
	if (!import.meta.env.SSR) {
		if (SSR !== undefined) return SSR;
		SSR = !!document.getElementById('app')?.getAttribute('data-server-rendered');
		return SSR;
	}
}