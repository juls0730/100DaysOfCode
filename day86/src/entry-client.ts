import { renderPage } from './lib/router/pageRenderer';

await import('./style.css');
await renderPage();

window.onpopstate = async e => {
	if (e.state === null) {
		return;
	}

	await renderPage();
};