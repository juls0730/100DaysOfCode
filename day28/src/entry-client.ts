// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState, isSSR } from './main'; 


async function initClient() {
	if (import.meta.env.SSR) return;
	await import('./style.css');
	const { renderPage } = await import('./lib/router/pageRenderer');
	await renderPage();

	window.onpopstate = async (e: PopStateEvent) => {
		if (e.state === null) {
			return;
		}
		await renderPage();
	};
}

// async function initSSR() {
// 	const { hydratePage } = await import('./lib/router/hydrationManager');
// 	await hydratePage();
// }

if (!import.meta.env.SSR) {
	if (!isSSR()) initClient();
}