import { getAppState, initAppState } from '../../main';
import { renderPage } from './pageRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getCookie, setCookie } from '../cookieManager';
import { Reactive } from '../ReactiveObject';

// function to turn the template into reactive content "hydating" a page
export async function hydratePage(reduceJavascript = false) {
	if (import.meta.env.SSR) return;

	await initAppState();
	const appState = getAppState();
	const documentBody = document.getElementById('app');

	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}

	ReactifyTemplate(appState);

	// here we look for elements with the d-on:click attribute and on click run the function in the attribute
	hydrateElement('*[d-on:click]', appState, 'click', getCookie, setCookie);

	// here we determine if an element should be deleted form the DOM via the d-if directive
	hydrateIfAttributes(appState);

	hydrateElement('*[d-on:pointerEnter]', appState, 'pointerenter', getCookie, setCookie);
	hydrateElement('*[d-on:pointerExit]', appState, 'pointerleave', getCookie, setCookie);
	hydrateElement('*[d-on:mouseDown]', appState, 'mousedown', getCookie, setCookie);
	hydrateElement('*[d-on:mouseUp]', appState, 'mouseup', getCookie, setCookie);

	// here we look for elements with the d-model attribute and if there is any input in the element then we update the appState item with the name
	// of the attribute value
	// example: if the user types "hello" into a text field with the d-model attribute of "text" then we update the appState item with the name "text"
	//          to "hello"
	// similar to vue.js v-model attribute
	hydrateModelAttributes(appState);

	hydrateHeadElements(appState);
	hydrateAnchorElements(reduceJavascript);
	hydrateKeyDown(appState);
}

export function ReactifyTemplate(appState: Reactive) {
	const spanElements = Array.from(document.querySelectorAll('span'));

	spanElements.forEach(spanElement => {
		// Get all attributes that start with "data-token-"
		const reactiveElms = Array.from(spanElement.attributes).filter(attr => attr.name.startsWith('data-token-'));

		if (reactiveElms.length === 0) return;

		reactiveElms.forEach(reactiveElm => {
			const item = reactiveElm.name;
			const uuid = item.split('data-token-')[1];

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
				appState.listen(decodedUuid, change => spanElement.innerHTML = change);
			} else {
				appState.listen(decodedUuid, change => spanElement.textContent = change);
			}
		});
	});
}

export function hydrateIfAttributes(appState: Reactive) {
	const conditionalElms = Array.from(document.querySelectorAll('*[d-if]'));
	if (conditionalElms.length === 0) return;
	conditionalElms.forEach(async (e: Element) => {
		const condition = e.getAttribute('d-if');

		const siblingConditionalElms: Array<Element> = [];
		// recursively check for subsequent elements with the d-else of d-else-if attribute
		function checkForConditionSibling(elm: Element) {
			if (!elm.nextElementSibling || typeof elm.nextElementSibling == 'undefined') return;
			if (elm.nextElementSibling?.getAttribute('d-else-if') !== null) {
				siblingConditionalElms.push(elm.nextElementSibling);
				if (!elm.nextElementSibling) return;
				checkForConditionSibling(elm.nextElementSibling);
			}

			if (elm.nextElementSibling?.getAttribute('d-else') !== null) {
				siblingConditionalElms.push(elm.nextElementSibling);
			}
		}
		checkForConditionSibling(e);

		if (siblingConditionalElms == undefined) return;

		function resetHTML() {
			e.innerHTML = '<!-- d-if -->';
			siblingConditionalElms.forEach((elm) => {
				if (!elm) return;
				elm.innerHTML = '<!-- d-if -->';
			});
		}

		let ifStatement = `if (${condition}) {
            e.innerHTML = "${e.innerHTML}"
        } `;

		siblingConditionalElms.forEach((element, i) => {
			if (!element) return;
			const siblingHTML = element.innerHTML;
			element.innerHTML = '<!-- d-if -->';
			let statementDirective = 'else';
			element.removeAttribute('d-else');
			if (element.getAttribute('d-else-if') !== null) {
				statementDirective = 'else if';
			}
			const condition = element.getAttribute('d-' + statementDirective.split(' ').join('-'));

			if (statementDirective == 'else if') {
				statementDirective = `else if (${condition})`;
				element.removeAttribute('d-else-if');
			}

			ifStatement = ifStatement + statementDirective + `{
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

export function hydrateElement(querySelector: string, appState: Reactive, eventListenerName: string, getCookie: CallableFunction, setCookie: CallableFunction, removeAttribute?: boolean) {
	const queryName: Array<string> | null = /(?<=\[).+?(?=\])/.exec(querySelector);
	if (!queryName || !queryName[0]) return;
	const querySelectorAll = (querySelector.replace(':', '\\3A '));
	querySelector = queryName[0];
	const elms = Array.from(document.querySelectorAll(querySelectorAll.toString()));
	if (elms.length === 0) return;
	elms.forEach(async (e: Element) => {
		const hydrationFunction = e.getAttribute(`${querySelector}`);

		if (removeAttribute === undefined || removeAttribute === true) {
			e.removeAttribute(`${querySelector}`);
		}
		if (!hydrationFunction) return;
		e.addEventListener(eventListenerName, () => {
			eval(hydrationFunction);
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

export function hydrateAnchorElements(reduceJavascript: boolean) {
	const anchorElms = Array.from(document.querySelectorAll('a'));
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
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hydrateKeyDown(appState: Reactive) {
	Array.from(document.body.querySelectorAll('*')).forEach((e: Element) => {
		const keydownElms = Array.from(e.attributes).filter((arrElm: Attr) => {
			return arrElm.name.startsWith('d-on:keydown');
		});

		if (keydownElms.length === 0) return;
		keydownElms.forEach((attr: Attr) => {
			const item = attr.name;
			let key = item.split('.')[1]?.toLowerCase();
			if (key && key?.length > 0) {
				key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
			}
			e.addEventListener('keydown', (keydown: KeyboardEvent) => {
				let keyName = keydown.key;
				if (keyName === ' ') {
					keyName = 'Space';
				}
				const firstLetter = keyName.split('')[0];
				keyName = firstLetter?.toUpperCase() + keyName.slice(1).toLowerCase();
				if (keyName === key) {
					const itemCode = e.getAttribute(item);
					if (!itemCode) return;
					// Instead of using the `eval` function, we can use a `try...catch` block to
					// execute the code and catch any potential errors.
					try {
						// We can use the `Function` constructor to create a new function from the
						// code string, and then call that function to execute the code.
						const fn = new Function(itemCode);
						fn();
					} catch (error) {
						// If there is an error, we can log it to the console for debugging purposes.
						console.error(error);
					}
				}
			});
		});
	});
}
