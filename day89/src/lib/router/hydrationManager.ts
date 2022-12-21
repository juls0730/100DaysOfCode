import { getAppState } from '../../main';
import { renderPage } from './pageRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getCookie, setCookie } from '../cookieManager';
import { Reactive } from '../ReactiveObject';

// function to turn the template into reactive content "hydating" a page
export async function hydratePage(reduceJavascript: boolean) {
	if (import.meta.env.SSR) return;
	if (reduceJavascript == undefined) reduceJavascript = false;
	const appState = await getAppState();
	const documentBody = document.getElementById('app');

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	ReactifyTemplate(appState);

	hydrateHeadElements(appState);
	hydrateIfAttributes(appState);
	hydrateAnchorElements(reduceJavascript);

	// interactive hydration
	hydrateBindElements(appState, documentBody);
	hydrateElements(appState);

	// Update app state items with input values from elements with the "d-model" attribute.
	// Similar to Vue.js' v-model attribute.
	hydrateModelAttributes(appState);
}

export function ReactifyTemplate(appState: Reactive) {
	const spanElements = Array.from(document.querySelectorAll('span'));

	spanElements.forEach(spanElement => {
		// Get all attributes that start with "data-token-"
		const reactiveElms = Array.from(spanElement.attributes).filter(attr => attr.name.startsWith('data-token-'));

		if (reactiveElms.length === 0) return;

		reactiveElms.forEach(reactiveElm => {
			const attributeName = reactiveElm.name;
			const uuid = attributeName.split('data-token-')[1];

			// If the uuid is not found, throw an error
			if (!uuid) throw new Error('Internal error: decoded uuid not found');

			// Decode the uuid
			let decodedUuid = '';
			for (let i = 0; i < uuid.length; i += 2) {
				decodedUuid += String.fromCharCode(parseInt(uuid.substr(i, 2), 16));
			}

			// If the span element's parent has the "d-once" attribute, remove it and return since we're only doing it once
			if (spanElement.parentElement?.hasAttribute('d-once')) {
				spanElement.parentElement.removeAttribute('d-once');
				return;
			}

			// If the span element's parent has the "d-html" attribute, listen to the decoded uuid
			// and set the span element's innerHTML to the change value
			if (spanElement.parentElement?.hasAttribute('d-html')) {
				appState.listen(decodedUuid, (change: string) => spanElement.innerHTML = change);
				return;
			}

			appState.listen(decodedUuid, (change: string | null) => spanElement.textContent = change);
		});
	});
}

export function hydrateIfAttributes(appState: Reactive) {
	const conditionalElms = Array.from(document.querySelectorAll('*[d-if]'));
	if (conditionalElms.length === 0) return;
	conditionalElms.forEach(async (e: Element) => {
		const condition = e.getAttribute('d-if');

		const siblingConditionalElms: Array<Element> = [];
		let currentElm = e;
		// recursively check for subsequent elements with the d-else of d-else-if attribute
		while (currentElm.nextElementSibling) {
			const nextElm = currentElm.nextElementSibling;
			if (nextElm.getAttribute('d-else-if') !== null) {
				siblingConditionalElms.push(nextElm);
			} else if (nextElm.getAttribute('d-else') !== null) {
				siblingConditionalElms.push(nextElm);
				break;
			}
			currentElm = nextElm;
		}

		if (siblingConditionalElms == undefined) return;

		const resetHTML = () => {
			e.innerHTML = '<!-- d-if -->';
			siblingConditionalElms.forEach((elm) => {
				elm.innerHTML = '<!-- d-if -->';
			});
		};

		let ifStatement = `if (${condition}) {
            e.innerHTML = "${e.innerHTML}"
        } `;

		siblingConditionalElms.forEach((element, i) => {
			const siblingHTML = element.innerHTML;
			element.innerHTML = '<!-- d-if -->';
			let statementDirective = 'else';
			element.removeAttribute('d-else');
			if (element.hasAttribute('d-else-if')) statementDirective = 'else if';
			const condition = element.getAttribute('d-' + statementDirective.split(' ').join('-'));

			if (statementDirective == 'else if') {
				statementDirective = `else if (${condition})`;
				element.removeAttribute('d-else-if');
			}

			ifStatement = `${ifStatement} ${statementDirective} {
                siblingConditionalElms[${i}].innerHTML = "${siblingHTML}"
            }`;
		});

		e.removeAttribute('d-if');
		if (!condition) return;
		resetHTML();
		eval(ifStatement);

		if (condition.includes('appState.contents.')) {
			let reactiveProp: Array<string> | string | null | undefined = /appState\.contents\.[a-zA-Z]+/.exec(condition);
			if (!reactiveProp || !reactiveProp[0]) return;
			reactiveProp = reactiveProp[0].split('.')[2];
			if (!reactiveProp) return;
			appState.listen(reactiveProp, () => {
				resetHTML();
				eval(ifStatement);
			});
		}
	});
}

export function hydrateElements(appState: Reactive) {
	const elements = Array.from(document.getElementById('app').querySelectorAll('*'));

	const eventElements = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => attr.name.startsWith('d-on:'));
	});

	eventElements.forEach((e) => {
		const dOnAttrs = Array.from(e.attributes).filter(attr => attr.name.startsWith('d-on:'));

		dOnAttrs.forEach((attr) => {
			const [eventType, ...modifiers] = attr.name.split(':')[1].split('.');
			const code = attr.value;
			const isKeyboardEvent = (eventType.startsWith('key')) ? true : false;
			const keyName = (isKeyboardEvent && modifiers[0]) ? modifiers[0].charAt(0).toUpperCase() + modifiers[0].slice(1).toLowerCase() : '';
			e.removeAttribute(attr.name);

			e.addEventListener(eventType, (event) => {
				let eventKey = event.key;
				if (isKeyboardEvent && eventKey === ' ') {
					eventKey = 'Space';
				}
				const firstLetter = eventKey.split('')[0];
				eventKey = firstLetter?.toUpperCase() + eventKey.slice(1).toLowerCase();

				for (let i = 0; i < modifiers.length; i++) {
					const modifier = modifiers[i];

					if (modifier === 'stop') {
						event.stopPropagation();
					}

					if (modifier === 'prevent') {
						event.preventDefault();
					}

					if (modifier === 'self') {
						if (e !== event.target) return;
					}
				}

				if (!isKeyboardEvent || !keyName) {
					eval(code);
				} else if (eventKey === keyName) {
					eval(code);
				}
			}, { once: modifiers.some(mod => mod === 'once'), capture: modifiers.some(mod => mod === 'capture'), passive: modifiers.some(mod => mod === 'passive') });
		});
	});
}

export function hydrateModelAttributes(appState: Reactive) {
	const modelElms = Array.from(document.querySelectorAll('input[d-model], textarea[d-model]'));
	if (modelElms.length === 0) return;
	modelElms.forEach((e: Element) => {
		const modelName = e.getAttribute('d-model');
		if (!modelName) return;
		e.addEventListener('input', (input: Event) => {
			const target = input.target as HTMLInputElement;
			appState.contents[modelName] = target.value;
		});
	});
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hydrateHeadElements(appState: Reactive) {
	const headContent = document.head.innerHTML;
	const headElements = Array.from(document.querySelectorAll('devto\\3A head'));
	if (headElements.length === 0) return;
	headElements.forEach((e: Element) => {
		if (e.childNodes.length == 0) return;
		e.childNodes.forEach((elm) => {
			const child = elm as Element;
			if (child.nodeType !== 1) return;
			if (!document.head.querySelectorAll(child.tagName)) return;
			document.head.appendChild(child);
		});
		e.remove();
	});

	document.addEventListener('router:naviagte', () => {
		document.head.innerHTML = headContent;
	}, { once: true });
}

export async function hydrateAnchorElements(reduceJavascript: boolean) {
	const anchorElms = document.querySelectorAll('a');

	Array.from(anchorElms).forEach((e: HTMLAnchorElement) => {
		if (!reduceJavascript && e.href === window.location.href) {
			e.setAttribute('link:active', '');
			e.setAttribute('tabindex', '-1');
		}
		e.addEventListener('click', async (click: MouseEvent) => {
			if (!event || click.ctrlKey) return;
			const target = click.target as HTMLElement;
			event.preventDefault();

			if (!target) return;
			const url: string | null = target.getAttribute('href');

			if (!url) return;
			await renderPage(url);
		});
	});
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hydrateBindElements(appState: Reactive, rootElement: Element) {
	const bindRegex = /^(?:d-bind:|:)/;

	Array.from(rootElement.querySelectorAll('*')).forEach((e: Element) => {
		const bindElms = Array.from(e.attributes).filter((arrElm: Attr) => {
			return bindRegex.test(arrElm.name);
		});

		if (bindElms.length === 0) return;
		bindElms.forEach((attr: Attr) => {
			const keyName = attr.name.split(':')[1];
			const originalValue = '(' + attr.value + ')';
			let currentBinding = '';

			e.removeAttribute(attr.name);

			function setAttribute() {
				if (!keyName) return;
				let value = 'return "' + originalValue + '"';
				const attribute = e.getAttribute(keyName);
				if (value.includes('(') || value.includes(')') || value.includes('?') || value.includes(':')) {
					value = eval(originalValue);
				}
				if (!value || !attribute) return;
				if (attribute) {
					const originalAttributeValue = (attribute.toString()).split(`${currentBinding}`).join('');
					currentBinding = value;
					value = originalAttributeValue + ' ' + value;
				}
				e.setAttribute(keyName, value);
			}

			if (originalValue.includes('appState')) {
				originalValue.split(' ').forEach((value) => {
					const propName = value.split('appState.contents.')[1];
					if (!propName || !value.includes('appState')) return;
					appState.listen(propName.replace(')', ''), () => setAttribute());
				});
			}

			setAttribute();

		});
	});
}