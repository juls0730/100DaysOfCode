import { compileToString } from '../templateRenderer';
import { isSSR } from '../../entry-client';
import { ctrlPressed } from './hydrationManager';
import { appState } from '../../main';
const tags = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'decorator', 'del', 'details', 'dfn', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'shadow', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
// let enabled = true;

function isHTML(tag: string) {
	return tags.indexOf(tag.trim().toLowerCase()) > -1;
}

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
	if (ctrlPressed && route) {
		window.open(route, '__blank');
		return;
	}

	// Gotta remove all the style and script tags from this page so they dont leak into other pages
	let decimateMode = false;
	document.head.childNodes.forEach((e, i, arr) => {
		if (!arr[i - 2]) return;
		if (decimateMode) {
			document.head.removeChild(e);
		}
		if (arr[i - 2]?.nodeName == '#comment' && arr[i - 2]?.textContent == 'style-outlet') {
			decimateMode = true;
		}
	});


	if (!window.history) {
		// enabled = false;
		return;
	}

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	if (route) history.pushState('', '', route);

	let fileName: string | Array<string> = window.location.pathname.split('/');
	if (fileName[1] === '') {
		fileName = '/index';
	} else {
		fileName = fileName.join('/').toLowerCase().trim();
	}

	const page: string | undefined = await loadPage(fileName);

	if (!page) return;

	// tell the web page that the router has loaded a new page, SSR is unaffected
	document.dispatchEvent(new CustomEvent('router:load', {
		detail: {
			page: fileName,
			url: window.location.pathname,
			tempalte: page,
			timeStamp: new Date().getTime()
		}
	}));

	const stringifiedTemplate = await compileToString(page);

	if (!stringifiedTemplate) return;

	if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD && !import.meta.env.SSR) {
		console.groupCollapsed('Loaded page ' + fileName);
		console.info('Template: ' + page);
		console.info('stringified template: ' + stringifiedTemplate.fnStr);
		console.groupEnd();
	}

	documentBody.innerHTML = await eval(stringifiedTemplate.fnStr);
	if (stringifiedTemplate.styles) {
		const cssElement = document.createElement('style');
		cssElement.type = 'text/css';
		cssElement.innerHTML = stringifiedTemplate.styles;
		document.head.appendChild(cssElement);
	}

	if (stringifiedTemplate.script) {
		const scriptElement = document.createElement('script');
		scriptElement.type = 'text/javascript';
		scriptElement.innerHTML = stringifiedTemplate.script;
		document.head.appendChild(scriptElement);
	}
	// here we hydrate/re-hydrate the page content
	const { hydratePage } = await import('./hydrationManager');
	await hydratePage();
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
		throw new Error('Something went wrong');
	})
		.then((data) => {
			if (!data) return undefined;
			return data;
		})
		.catch(async () => {
			await fetch(path + 'layouts/404.devto').then((response) => {
				if (response.ok) {
					return response.text();
				}
				throw new Error('Something went wrong');
			})
				.then((data) => {
					if (!data) return undefined;
					return data;
				});
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
		await fetch(path + `components/${component}.devto`).then((response) => {
			if (response.ok) {
				return response.text();
			}
			throw new Error('Something went wrong');
		})
			.then((data) => {
				file = data;
			});
		template = template.replace('<' + component + ' />', file);
	})
	);

	return template;
}