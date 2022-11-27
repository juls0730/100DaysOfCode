// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState, initAppState } from './main'; 

async function initClient() {
	if (import.meta.env.SSR) return;
	await initAppState();
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

await initClient();