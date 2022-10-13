// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { setCtrl } from './lib/router/hydrationManager';
import { appState } from './main';

let SSR: boolean;

export function isSSR() {
	if (!import.meta.env.SSR) {
		if (SSR !== undefined) return SSR;
		SSR = !!document.getElementById('app')?.getAttribute('data-server-rendered');
		return SSR;
	}
}

async function initClient() {
	await import('./style.css');
	const { renderPage } = await import('./lib/router/pageRenderer');
	await renderPage();
	
	document.body.addEventListener('keydown', (e) => {
		setCtrl(e.ctrlKey);
	});

	document.body.addEventListener('keyup', (e) => {
		setCtrl(e.ctrlKey);
	});

	window.onpopstate = async (e: PopStateEvent) => {
		if (e.state === null) {
			return;
		}
		await renderPage();
	};
}

async function initSSR() {
	const { hydratePage } = await import('./lib/router/hydrationManager');
	await hydratePage();
}

if (!import.meta.env.SSR) {
	if (!isSSR()) {
		initClient();
	} else {

		initSSR();
	}
}