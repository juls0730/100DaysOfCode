import { compileToString } from '../templateRenderer';
import { appState, isSSR, isHTML, debugMode, getAppState } from '../../main';
import { LRUCache } from '../lruCache';
import { hydratePage } from './hydrationManager';

if (!appState) app = await getAppState();

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

	let page: string = await fetchPage(fileName, 'pages');

	if (!page) return;

	const metaObj = { 'layout': 'default', 'reduceJavascript': false, 'suspendUntilHydrated': true };

	parseFromRegex(page, /<script>[\s\S]*?<\/script>/gi).forEach((e) => {
		if (!e || !e.startsWith('<script>') || !e.endsWith('</script>')) return;

		parseFromRegex(e, /definePageMeta\({(.*?)}\)(;){0,1}/g).forEach((metaElm) => {
			if (!metaElm || !metaElm.startsWith('definePageMeta({')) return;

			let metaObjString = metaElm.split('(')[1]?.split(')')[0];
			if (!metaObjString) return;

			metaObjString = metaObjString
				.replaceAll(' ', '')
				.replaceAll('{', '{\'')
				.replaceAll(':', '\':')
				.replaceAll(',', ',\'')
				.replaceAll('\'', '"');

			const newMetaObj = JSON.parse(metaObjString);
			Object.keys(newMetaObj).forEach((key) => {
				metaObj[key] = newMetaObj[key];
			});
			console.log(metaObj);
		});
	});

	let layout: string;
	try {
		layout = await fetchPage(`/${metaObj.layout}`, 'layouts', false);
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

	if (stringifiedTemplate.script || stringifiedTemplate.setupScript) {
		const scriptElement = document.createElement('script');
		scriptElement.async = true;
		scriptElement.type = 'module';
		scriptElement.setAttribute('local', 'true');
		scriptElement.innerHTML = stringifiedTemplate.setupScript + stringifiedTemplate.script;
		document.head.appendChild(scriptElement);
	}

	// here we hydrate/re-hydrate the page content
	await hydratePage(metaObj.reduceJavascript);

	if (metaObj.suspendUntilHydrated) {
		// here we show the page as its been hydtated
		document.body.style.display = 'block';
	}

	// tell the document that the client has fully rendered and hydrated the page
	document.dispatchEvent(new Event('router:client:load'));
}

async function fetchPage(url: string, dir: string, return404?: boolean): Promise<string> {
	if (import.meta.env.SSR) return '';
	if (isSSR()) throw new Error('page shouldnt be loaded on server side');
	if (return404 === undefined) return404 = true;
	let path: string;
	(import.meta.env.PROD) ? path = '/' : path = '/src/';

	const cachedFile = cache.get(dir + url);

	async function render() {
		let file: string | undefined;
		if (cachedFile) {
			if (debugMode) {
				console.groupCollapsed(`🗃️ Loaded page ${dir}${url} from cache`);
				console.log(cachedFile);
				console.groupEnd();
			}

			file = cachedFile;
			return file;
		}

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
		return file;
	}

	let file = await render();

	if (!file) return '';

	let template = file;
	const elements: Array<string> = file.split('<').filter(e => e !== undefined);
	const renderedComponents: Array<string> = [];

	const promises = elements.map(async (component: string) => {
		component = component.split(' ')[0];
		if (component?.includes('/') || component?.includes('{') || !component) return;

		component = component.split('>')[0];

		if (!component) return;
		if (isHTML(component)) return;

		const slottedComponent = template.split('<' + component + '>');
		let isSlotted = false;
		let slotData: string | undefined;
		if (slottedComponent.length > 1) {
			isSlotted = true;
			slottedComponent.forEach((splitComponent, i, arr) => {
				if (splitComponent.includes('</' + component + '>')) {
					slotData = arr[i]?.split('</' + component + '>')[0];
				}
			});
			template = template.split('<' + component + '>' + slotData + '</' + component + '>').join('<!--' + component + '-->');
		}

		if (renderedComponents.indexOf(component) == -1) {
			renderedComponents.push(component);
			file = await renderComponent(component, path);
			if (isSlotted && slotData) {
				file = file.replaceAll('<slot />', slotData);
			}

			let componentName = '<' + component;
			(!isSlotted) ? componentName += ' />' : componentName = '<!--' + component + '-->';

			template = template.replaceAll(componentName, file);
		}
	});

	await Promise.all(promises);


	return template;
}

async function renderComponent(component: string, path: string) {

	const componentName = component;

	async function render() {
		const cachedComponent = cache.get('components/' + component);
		if (cachedComponent) {
			if (debugMode) {
				console.groupCollapsed(`🗃️ Loaded component ${component} from cache`);
				console.log(cachedComponent);
				console.groupEnd();
			}

			return cachedComponent;
		}
		const data = await fetch(path + `components/${component}.devto`)
			.then(response => response.ok ? response.text() : '');

		cache.set('components/' + component, data);

		if (debugMode) {
			console.groupCollapsed(`🌐 Fetched component ${component}`);
			console.log('Template:', data);
			console.groupEnd();
		}

		return data;
	}

	component = await render();

	const elements = component.split('<').filter(e => !!e);

	const promises = elements.map(async (componentInComponent: string) => {
		componentInComponent = componentInComponent.split(' ')[0];

		if (componentInComponent?.includes('/') || componentInComponent?.includes('{')) return;

		const [name] = componentInComponent.split('>');

		if (!name || isHTML(name)) return;

		if (name === componentName) {
			console.error(`Cannot include a component in itself, ignoring component (rendering ${name})`);
			return;
		}

		const slottedComponent = component.split(`<${name}>`);
		let isSlotted = false;
		let slotData: string | undefined;

		if (slottedComponent.length > 1) {
			isSlotted = true;
			const splitComponent = slottedComponent.find(e => e.includes(`</${name}>`));
			if (splitComponent) {
				slotData = splitComponent.split(`</${name}>`)[0];
			}
			component = component.split(`<${name}>${slotData}</${name}>`).join(`<!--${name}-->`);
		}

		let componentReplacement = await renderComponent(name, path);

		if (isSlotted && slotData) {
			componentReplacement = componentReplacement.replaceAll('<slot />', slotData);
		}

		const replacementComponentName = isSlotted ? `<!--${name}-->` : `<${name} />`;
		component = component.replaceAll(replacementComponentName, componentReplacement);
	});

	await Promise.all(promises);

	return component;
}

function parseFromRegex(template: string, regex: RegExp) {
	const matches = template.match(regex);
	if (!matches) {
		return [template];
	}

	const arr = [];
	let startIndex = 0;
	for (const match of matches) {
		const matchIndex = template.indexOf(match, startIndex);
		if (matchIndex > 0) {
			arr.push(template.substring(startIndex, matchIndex));
		}
		arr.push(match);
		startIndex = matchIndex + match.length;
	}

	if (startIndex < template.length) {
		arr.push(template.substring(startIndex));
	}

	return arr;
}