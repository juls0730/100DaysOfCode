import { Reactive } from './lib/ReactiveObject';

export let appState: Reactive;

export async function initAppState() {
	const { getCookie } = await import('./lib/cookieManager');
	appState = new Reactive({
		count: 0,
		text: '',
		cookie: getCookie('username'),
		html: '',
		year: '',
		cookiedata: '',
		audioObj: {data: '', playing: false, time: 0},
	});
}

export function resetAppState() {
	appState = new Reactive({});
}

export function getAppState() {
	return appState;
}

let SSR: boolean;

export function isSSR() {
	if (import.meta.env.SSR) return true;
	if (SSR !== undefined) return SSR;
	SSR = !!document.getElementById('app')?.getAttribute('data-server-rendered');
	return SSR;
}

export function isHTML(tag: string) {
	const tags = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'decorator', 'del', 'details', 'devto:head', 'dfn', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'shadow', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
	return tags.indexOf(tag.trim().toLowerCase()) > -1;
}