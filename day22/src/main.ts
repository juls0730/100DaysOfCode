import { Reactive } from './lib/ReactiveObject';
const { getCookie } = await import('./lib/cookieManager');

export const appState: Reactive = new Reactive({
	count: 0,
	cookie: getCookie('username'),
	text: '',
	html: '',
	year: '',
	cookiedata: '',
});