import { compileToString } from '../templateRenderer';
import { appState, isSSR, isHTML, debugMode } from '../../main';
import { LRUCache } from '../lruCache';

if (!appState) console.error('no reactive data found');

let documentBody: string | HTMLElement | null;
const cache = new LRUCache(15);

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
		throw new Error('window.history is not supported, please update your browser');
	}

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	if (route && route === window.location.pathname) return;

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

	let page: string = await loadPage(fileName, 'pages');

	if (!page) return;

	const metaObj = { 'layout': 'default', 'reduceJavascript': false, 'suspendUntilHydrated': true };

	parseFromRegex(page, /<script>[\s\S]*?<\/script>/gi).map((e: string | undefined) => {
		if (!e) return;
		if (e.startsWith('<script>') && e.endsWith('</script>')) {
			parseFromRegex(e, /definePageMeta\({(.*?)}\)(;){0,1}/g).map((metaElm: string | undefined) => {
				if (!metaElm) return;
				if (metaElm.startsWith('definePageMeta({')) {
					let metaObjString = metaElm.split('(')[1]?.split(')')[0];
					if (!metaObjString) return;
					metaObjString = metaObjString.replaceAll(' ', '').replaceAll('{', '{\'').replaceAll(':', '\':').replaceAll(',', ',\'').replaceAll('\'', '"');
					const newMetaObj = JSON.parse(metaObjString);
					Object.keys(newMetaObj).forEach((key) => {
						metaObj[key] = newMetaObj[key];
					});
				}
			});
		}
	});

	let layout: string;
	try {
		layout = await loadPage(`/${metaObj.layout}`, 'layouts', false);
	} catch {
		layout = '<slot />';
	}

	if (!layout) return;

	page = layout.replaceAll('<slot />', page);

	const stringifiedTemplate = await compileToString(page);

	if (!stringifiedTemplate) return;

	if (debugMode) {
		console.groupCollapsed('✨ Redered page ' + fileName.slice(1));
		console.log('Template: ' + page);
		console.info('stringified template: ' + stringifiedTemplate.fnStr);
		console.groupEnd();
	}

	// since we have all the html content ready to place in the app, we first need to remove all the old injected content
	if (route) {
		const childrenToRemove = document.head.querySelectorAll('*[local]');
		childrenToRemove.forEach(child => document.head.removeChild(child));
	}

	if (metaObj.suspendUntilHydrated) {
		// here we are hiding the body and hydrating the page "suspending"
		document.body.style.display = 'none';
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
	await hydratePage(metaObj.reduceJavascript);

	if (metaObj.suspendUntilHydrated) {
		// here we show the page as its been hydtated
		document.body.style.display = 'block';
	}

	// this is super bad but it works s good, fix later
	setTimeout(() => {
		// tell the document that the client has fully rendered and hydrated the page
		document.dispatchEvent(new Event('router:client:load'));
	}, 15);
}

async function loadPage(page: string, dir: string, return404?: boolean): Promise<string> {
	if (import.meta.env.SSR) return '';
	if (isSSR()) throw new Error('page shouldnt be loaded on server side');
	if (return404 === undefined) return404 = true;
	const file = await fetchPage(page, dir, return404);

	return file;
}

async function fetchPage(url: string, dir: string, return404: boolean): Promise<string> {
	let path: string;
	(import.meta.env.PROD) ? path = '/' : path = '/src/';

	let file: string | undefined;
	const cachedFile = cache.get(dir + url);

	if (cachedFile) {
		if (debugMode) {
			console.groupCollapsed(`🗃️ Loaded page ${dir}${url} from cache`);
			console.log(cachedFile);
			console.groupEnd();
		}

		file = cachedFile;
	} else {
		file = await fetch(path + `${dir}${url}.devto`).then((response) => {
			if (response.ok) {
				return response.text();
			}
			throw new Error('File not found');
		})
			.then((data) => {
				if (!data) return undefined;
				cache.set(dir + url, data);
				console.groupCollapsed(`🌐 Fetched page ${dir}${url}`);
				console.log(data);
				console.groupEnd();
				return data;
			})
			.catch(async () => {
				if (!return404) {
					throw new Error('object not found and not returning a 404 page');
				}
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
	}


	if (!file) return '';

	let template = file;
	const elements: Array<string> = file.split('<');
	const renderedComponents: Array<string> = [];

	await Promise.all(elements.map(async (component: string | undefined) => {
		if (!component || !file) return;
		component = component.split(' ')[0];
		if (component?.includes('/') || component?.includes('{') || !component) return;
		component = component.split('>')[0];
		if (!component) return;
		if (isHTML(component)) return;
		const slotedComponent = template.split('<' + component + '>');
		let isSloted = false;
		let slotData: string | undefined;
		if (slotedComponent.length > 1) {
			isSloted = true;
			slotedComponent.forEach((splitComponent, i, arr) => {
				if (splitComponent.includes('</' + component + '>')) {
					slotData = arr[i]?.split('</' + component + '>')[0];
				}
			});
			template = template.split('<' + component + '>' + slotData + '</' + component + '>').join('<!--' + component + '-->');
		}

		if (renderedComponents.indexOf(component) == -1) {
			renderedComponents.push(component);
			file = await renderComponent(component, path);

			let componentName = '<' + component;
			(!isSloted) ? componentName += ' />' : componentName = '<!--' + component + '-->';

			template = template.replaceAll(componentName, file);
		}
	})
	);

	return template;
}

async function renderComponent(component: string, path: string) {
	const componentName = component;
	const cachedComponent = cache.get('components/' + component);

	if (cachedComponent) {
		if (debugMode) {
			console.groupCollapsed(`🗃️ Loaded component ${component} from cache`);
			console.log(cachedComponent);
			console.groupEnd();
		}

		component = cachedComponent;
	} else {
		await fetch(path + `components/${component}.devto`).then((response) => {
			if (response.ok) {
				return response.text();
			}
			return '';
		})
			.then((data) => {
				cache.set('components/' + component, data);
				if (debugMode) {
					console.groupCollapsed(`🌐 Fetched component ${component}`);
					console.log('Template:', data);
					console.groupEnd();
				}
				component = data;
			});
	}

	const elements = component.split('<');
	await Promise.all(elements.map(async (componentInComponent: string | undefined) => {
		if (!componentInComponent) return;
		componentInComponent = componentInComponent.split(' ')[0];
		if (componentInComponent?.includes('/') || componentInComponent?.includes('{') || !componentInComponent) return;
		componentInComponent = componentInComponent.split('>')[0];
		if (!componentInComponent) return;
		if (isHTML(componentInComponent)) return;
		if (componentInComponent === componentName) {
			console.error('Cannot include a component in itself, ignoring component (rendering ' + componentInComponent + ')');
			return;
		}
		const slotedComponent = component.split('<' + componentInComponent + '>');
		let isSloted = false;
		let slotData: string | undefined;
		if (slotedComponent.length > 1) {
			isSloted = true;
			slotedComponent.forEach((splitComponent, i, arr) => {
				if (splitComponent.includes('</' + componentInComponent + '>')) {
					slotData = arr[i]?.split('</' + componentInComponent + '>')[0];
				}
			});
			component = component.split('<' + componentInComponent + '>' + slotData + '</' + componentInComponent + '>').join('<!--' + componentInComponent + '-->');
		}

		let componentReplacement = await renderComponent(componentInComponent, path);
		if (isSloted && slotData) {
			componentReplacement = componentReplacement.replaceAll('<slot />', slotData);
		}
		let replacementComponentName = '<' + componentInComponent;
		(!isSloted) ? replacementComponentName += ' />' : replacementComponentName = '<!--' + componentInComponent + '-->';
		component = component.replaceAll(replacementComponentName, componentReplacement);
	}));

	return component;
}

function parseFromRegex(template: string, regex: RegExp) {
	let result = regex.exec(template);
	regex.lastIndex = 0;
	const arr = [];
	let firstPos;

	while (result) {
		firstPos = result.index;
		if (firstPos !== 0) {
			arr.push(template.substring(0, firstPos));
			template = template.slice(firstPos);
		}

		arr.push(result[0]);
		template = template.slice(result[0]?.length);
		result = regex.exec(template);
		regex.lastIndex = 0;
	}

	if (template) arr.push(template);
	return arr;
}