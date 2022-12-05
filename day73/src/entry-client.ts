import { initAppState } from './main'; 

async function initClient() {
	if (import.meta.env.SSR) return;
	await initAppState();
	await import('./style.css');
	const { renderPage } = await import('./lib/router/pageRenderer');
	await renderPage();

	window.onpopstate = async e => {
		if (e.state === null) {
			return;
		}
		
		await renderPage();
	};
}

await initClient();