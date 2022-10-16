import { appState } from '../../main';

export let ctrlPressed = false;

export function setCtrl(ctrl: boolean) {
	ctrlPressed = ctrl;
}

// function to turn the template into reactive content "hydating" a page
export async function hydratePage() {
	if (import.meta.env.SSR) return;
	const documentBody = document.getElementById('app');
	if (!documentBody) {
		throw new Error('Fatal Error: element with id app not found');
	}
	const { renderPage } = await import('./pageRenderer');

	// for every item in the appState lets check for any element with the "checksum", a hex code equivalent of the item name
	Object.keys(appState.contents).forEach((e: string) => {
		if (e === undefined) return;
		// here we check for elements with the name of "data-token-<hex code of the item name>"
		const uuid = e.split('').map((c: string) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
		const listeningElements = document.querySelectorAll(`[${'data-token-' + uuid}]`);
		listeningElements.forEach((elm) => {
			if (elm.parentElement?.getAttribute('d-once') !== null) {
				elm.parentElement?.removeAttribute('d-once');
				return;
			}

			if (elm.parentElement?.getAttribute('d-html') !== null) {
				appState.listen(e, (change: string) => elm.innerHTML = change);
				elm.parentElement?.removeAttribute('d-html');
			} else {
				appState.listen(e, (change: string) => elm.textContent = change);
			}
		});
	});

	// here we look for elements with the d-on:click attribute and on click run the function in the attribute
	const elms = documentBody.querySelectorAll('*[d-on\\3A click]');
	elms.forEach((e) => {
		const clickFunction = e.getAttribute('d-on:click');
		e.removeAttribute('d-on:click');
		if (!clickFunction) return;
		e.addEventListener('click', () => {
			eval(clickFunction);
		});
	});

	// here we determine if an element should be deleted form the DOM via the d-if directive
	const conditionalElms = document.querySelectorAll('*[d-if]');
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
			for (let i = 0; i < siblingConditionalElms.length; i++) {
				const element = siblingConditionalElms[i];
				if (!element) return;
				element.innerHTML = '<!-- d-if -->';
			}
		}

		let ifStatement = `if (!!eval(condition)) {
            e.innerHTML = originalHTML
        } `;

		for (let i = 0; i < siblingConditionalElms.length; i++) {
			const element = siblingConditionalElms[i];
			if (!element) return;
			const originHTML = element.innerHTML;
			element.innerHTML = '<!-- d-if -->';
			let statementDirective = 'else';
			if (element.getAttribute('d-else-if') !== null) {
				statementDirective = 'else if';
			}
			const condition = eval('element.getAttribute(\'d-\' + statementDirective.split(\' \').join(\'-\'))');

			if (statementDirective == 'else if') {
				statementDirective = 'else if (' + condition + ')';
			}

			ifStatement = ifStatement + statementDirective + `{
                siblingConditionalElms[${i}].innerHTML = "${originHTML}"
            }`;
		}

		e.removeAttribute('d-if');
		const originalHTML = e.innerHTML;
		if (!condition || originalHTML == undefined) return;
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


		eval(ifStatement);
	});

	const pointerEnterElms = document.querySelectorAll('*[d-on\\3A pointerEnter]');
	pointerEnterElms.forEach((e) => {
		const enterFunction = e.getAttribute('d-on:pointerEnter');
		e.removeAttribute('d-on:pointerEnter');
		if (!enterFunction) return;
		e.addEventListener('pointerenter', () => {
			eval(enterFunction);
		});
	});

	const pointerExitElms = document.querySelectorAll('*[d-on\\3A pointerExit]');
	pointerExitElms.forEach((e) => {
		const exitFunction = e.getAttribute('d-on:pointerExit');
		e.removeAttribute('d-on:pointerExit');
		if (!exitFunction) return;
		e.addEventListener('pointerleave', () => {
			eval(exitFunction);
		});
	});

	const mouseDownElms = document.querySelectorAll('*[d-on\\3A mouseDown]');
	mouseDownElms.forEach((e) => {
		const downFunction = e.getAttribute('d-on:mouseDown');
		e.removeAttribute('d-on:mouseDown');
		if (!downFunction) return;
		e.addEventListener('mousedown', () => {
			eval(downFunction);
		});
	});

	const mouseUpElms = document.querySelectorAll('*[d-on\\3A mouseUp]');
	mouseUpElms.forEach((e) => {
		const dupFunction = e.getAttribute('d-on:mouseUp');
		e.removeAttribute('d-on:mouseUp');
		if (!dupFunction) return;
		e.addEventListener('mouseup', () => {
			eval(dupFunction);
		});
	});

	// here we look for elements with the d-model attribute and if there is any input in the element then we update the appState item with the name
	// of the attribute value
	// example: if the user types "hello" into a text field with the d-model attribute of "text" then we update the appState item with the name "text"
	//          to "hello"
	// similar to vue.js v-model attribute
	const modelElms = document.querySelectorAll('input[d-model], textarea[d-model]');
	modelElms.forEach((e: Element) => {
		const modelName = e.getAttribute('d-model');
		if (!modelName) return;
		e.addEventListener('input', (input: Event) => {
			const target = input.target as HTMLInputElement;
			if (!target || !target.value) return;
			appState.contents[modelName] = target.value;
		});
	});

	const anchorElms = document.querySelectorAll('a');
	anchorElms.forEach((e: HTMLAnchorElement) => {
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

	function hydrateKeyDown() {
		document.body.querySelectorAll('*').forEach((e) => {
			for (let i = 0; i < e.attributes.length; i++) {
				const item = e.attributes.item(i)?.name;
				if (!item) return;
				if (item.startsWith('d-on:keydown')) {
					const key = item.split('.')[1]?.toLowerCase();
					let correctedKey = '';
					if (key && key?.length > 1) {
						key.split('').forEach((e, i, arr) => {
							if (i === 0) {
								arr[i] = e.toUpperCase();
							}
							correctedKey += arr[i];
						});
					}
					e.addEventListener('keydown', (keydown) => {
						const keyboardEvent = <KeyboardEvent>keydown;
						if (keyboardEvent.key == correctedKey) {
							const itemCode = e.getAttribute(item);
							if (!itemCode) return;
							eval(itemCode);
						}
					});
				}
			}
		});
	}
	hydrateKeyDown();
}