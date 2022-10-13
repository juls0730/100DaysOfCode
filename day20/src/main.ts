import { Reactive } from './lib/ReactiveObject';
import { getCookie } from './lib/cookieManager';

export const appState: Reactive = new Reactive({
	count: 0,
	cookie: getCookie('username'),
	text: '',
	html: '',
	year: '',
	cookiedata: '',
});