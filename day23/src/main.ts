import { Reactive } from './lib/ReactiveObject';

export const appState: Reactive = new Reactive({
	count: 0,
	text: '',
	html: '',
	year: '',
	cookiedata: '',
});