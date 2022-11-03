import { compileToString } from '../templateRenderer';
import { appState, isSSR, isHTML } from '../../main';

if (!appState) console.error('no reactive data found');

let documentBody: string | HTMLElement | null;

if (import.meta.env.SSR) {
	const fs = await import('fs');
	const path = await import('path');
	documentBody = fs.readFileSync(
		path.resolve('index.html'),
		'utf-8'
	);
} else {
	documentBody = document.getElementById('app');
}


// Global function to handle rendering a page and navigation
export async function renderPage(route?: string) {
	if (isSSR() || typeof documentBody == 'string') return;

	if (!window.history) {
		return;
	}

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	if (route) {
		history.pushState('', '', route);
		document.dispatchEvent(new Event('router:naviagte'));
	}

	let fileName: string | Array<string> = window.location.pathname.split('/');
	if (fileName[1] === '') {
		fileName = '/index';
	} else {
		fileName = fileName.join('/').toLowerCase().trim();
	}

	const page: string | undefined = await loadPage(fileName);

	if (!page) return;

	const stringifiedTemplate = await compileToString(page);

	if (!stringifiedTemplate) return;

	if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD && !import.meta.env.SSR) {
		console.groupCollapsed('Loaded page ' + fileName);
		console.info('Template: ' + page);
		console.info('stringified template: ' + stringifiedTemplate.fnStr);
		console.groupEnd();
	}

	// since we have all the html content ready to place in the app, we first need to remove all the old injected content
	if (route) {
		const childrenToRemove = document.head.querySelectorAll('*[local]');
		childrenToRemove.forEach(child => document.head.removeChild(child));
	}

	documentBody.innerHTML = await eval(stringifiedTemplate.fnStr);
	if (stringifiedTemplate.styles) {
		const cssElement = document.createElement('style');
		cssElement.type = 'text/css';
		cssElement.setAttribute('local', 'true');
		cssElement.innerHTML = stringifiedTemplate.styles;
		document.head.appendChild(cssElement);
	}

	if (stringifiedTemplate.script) {
		const scriptElement = document.createElement('script');
		scriptElement.async = true;
		scriptElement.type = 'module';
		scriptElement.setAttribute('local', 'true');
		scriptElement.innerHTML = stringifiedTemplate.script;
		document.head.appendChild(scriptElement);
	}

	// here we hydrate/re-hydrate the page content
	const { hydratePage } = await import('./hydrationManager');
	await hydratePage();

	// this is super bad but it works s good, fix later
	setTimeout(() => {
		// tell the document that the client has fully rendered and hydrated the page
		document.dispatchEvent(new Event('router:client:load'));
	}, 15);
}

async function loadPage(page: string) {
	if (import.meta.env.SSR) return;
	if (isSSR()) return;
	const file = await fetchPage(page);

	return file;
}

async function fetchPage(url: string) {
	let path: string;
	(import.meta.env.PROD) ? path = '/' : path = '/src/';

	let file: string | void | undefined = await fetch(path + `pages${url}.devto`).then((response) => {
		if (response.ok) {
			return response.text();
		}
		throw new Error('File not found');
	})
		.then((data) => {
			if (!data) return undefined;
			return data;
		})
		.catch(async () => {
			return (await fetch(path + 'layouts/404.devto').then((response) => {
				if (response.ok) {
					return response.text();
				}
				throw new Error('Error fetching 404 page');
			})
				.then((data) => {
					if (!data) return undefined;
					return data;
				}));
		});


	if (!file) return;

	let template = file;
	const elements: Array<string> = file.split('<');

	await Promise.all(elements.map(async (component: string | undefined) => {
		if (!component || !file) return;
		component = component.split(' ')[0];
		if (component?.includes('/') || component?.includes('{') || !component) return;
		component = component.split('>')[0];
		if (!component) return;
		if (isHTML(component)) return;
		file = await renderComponent(component, path);

		template = template.replace('<' + component + ' />', file);
	})
	);

	return template;
}

async function renderComponent(component: string, path: string) {
	await fetch(path + `components/${component}.devto`).then((response) => {
		if (response.ok) {
			return response.text();
		}
		return '';
	})
		.then((data) => {
			component = data;
		});

	const elements = component.split('<');
	await Promise.all(elements.map(async (componentInComponent: string | undefined) => {
		if (!componentInComponent) return;
		componentInComponent = componentInComponent.split(' ')[0];
		if (componentInComponent?.includes('/') || componentInComponent?.includes('{') || !componentInComponent) return;
		componentInComponent = componentInComponent.split('>')[0];
		if (!componentInComponent) return;
		if (isHTML(componentInComponent)) return;
		const componentReplacement = await renderComponent(componentInComponent, path);
		component = component.replace('<' + componentInComponent + ' />', componentReplacement);
	}));

	return component;
}