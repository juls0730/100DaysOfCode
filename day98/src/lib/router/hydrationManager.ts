import { getAppState } from '../../main';
import { renderPage } from './pageRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getCookie, setCookie } from '../cookieManager';

// function to turn the template into reactive content "hydating" a page
export async function hydratePage(virtDOM: Element, reduceJavascript: boolean) {
	if (import.meta.env.SSR) return;
	const appState = await getAppState();
	const documentBody = document.querySelector('div[id="app"]');

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	if (reduceJavascript === undefined) reduceJavascript = false;
	const elements = Array.from(virtDOM.querySelectorAll('*'));

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
				let firstLetter;
				if (isKeyboardEvent && eventKey === ' ') {
					eventKey = 'Space';
				}
				if (isKeyboardEvent) {
					firstLetter = eventKey.split('')[0];
					eventKey = firstLetter?.toUpperCase() + eventKey.slice(1).toLowerCase();
				}

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

	const modelElements = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => attr.name.startsWith('d-model'));
	});

	modelElements.forEach((modelElement) => {
		const modelName = modelElement.getAttribute('d-model');
		modelElement.removeAttribute('d-model');
		if (modelName === undefined || modelName === null) return;
		modelElement.addEventListener('input', (input: Event) => {
			const target = input.target as HTMLInputElement;
			appState.contents[modelName] = target.value;
		});
	});

	const bindElements = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => /^(?:d-bind:|:)/.test(attr.name));
	});

	bindElements.forEach((modelElm) => {
		const modelAttrs = Array.from(modelElm.attributes).filter(attr => attr.name.startsWith('d-bind:') || attr.name.startsWith(':'));

		modelAttrs.forEach((attr) => {
			const keyName = attr.name.split(':')[1];
			const originalValue = '(' + attr.value + ')';
			let currentBinding = '';

			modelElm.removeAttribute(attr.name);

			function setAttribute() {
				if (!keyName) return;
				let value = 'return "' + originalValue + '"';
				const attribute = modelElm.getAttribute(keyName);
				if (value.includes('(') || value.includes(')') || value.includes('?') || value.includes(':')) {
					value = eval(originalValue);
				}
				if (!value || !attribute) return;
				if (attribute) {
					const originalAttributeValue = (attribute.toString()).split(`${currentBinding}`).join('');
					currentBinding = value;
					value = originalAttributeValue + ' ' + value;
				}
				modelElm.setAttribute(keyName, value);
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

	const anchorElms = elements.filter((e) => {
		return e.tagName.toLowerCase() === 'a';
	});

	anchorElms.forEach((e: HTMLAnchorElement) => {
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

	const reactiveElms = elements.filter((e) => {
		return e.tagName.toLowerCase() === 'span' && Array.from(e.attributes).filter(el => el.name.startsWith('data-token-'));
	});

	reactiveElms.forEach((e) => {
		const reactiveAttributes = Array.from(e.attributes).filter(attr => attr.name.startsWith('data-token-'));

		reactiveAttributes.forEach((attr) => {
			const attributeName = attr.name;
			const uuid = attributeName.split('data-token-')[1];

			// If the uuid is not found, throw an error
			if (!uuid) throw new Error('Internal error: decoded uuid not found');

			// Decode the uuid
			let decodedUuid = '';
			for (let i = 0; i < uuid.length; i += 2) {
				decodedUuid += String.fromCharCode(parseInt(uuid.substr(i, 2), 16));
			}

			// If the span element's parent has the "d-once" attribute, remove it and return since we're only doing it once
			if (e.parentElement?.hasAttribute('d-once')) {
				e.parentElement.removeAttribute('d-once');
				return;
			}

			// If the span element's parent has the "d-html" attribute, listen to the decoded uuid
			// and set the span element's innerHTML to the change value
			if (e.parentElement?.hasAttribute('d-html')) {
				appState.listen(decodedUuid, (change: string) => e.innerHTML = change);
				return;
			}

			appState.listen(decodedUuid, (change: string | null) => e.textContent = change);
		});
	});

	const conditionalElms = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => attr.name === 'd-if');
	});

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

	document.getElementById('app')?.children[0].remove();
	document.getElementById('app')?.appendChild(virtDOM);
}