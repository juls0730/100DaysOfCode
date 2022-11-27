import { ReactifyTemplate, hydrateModelAttributes, hydrateKeyDown } from '../hydrationManager';
import { JSDOM } from 'jsdom';

function SSRHydrateElement(querySelector: string, eventListenerName: string, removeAttribute?: boolean) {
	let script = '';
	const queryName: Array<string> | null = /(?<=\[).+?(?=\])/.exec(querySelector);
	if (!queryName || !queryName[0]) return;
	const querySelectorAll = (querySelector.replace(':', '\\\\\\\\3A '));
	querySelector = queryName[0];
	let removeAttributeString = '';
	if (removeAttribute === undefined || removeAttribute === true) {
		removeAttributeString = `e.removeAttribute('${querySelector}');`;
	}
	script += `const ${querySelector.split(':')[1]}Elms = eval("document.querySelectorAll('${querySelectorAll}')");
	${querySelector.split(':')[1]}Elms.forEach((e) => {
		const ${querySelector.split(':')[1]}HydartionFunction = e.getAttribute('${querySelector}');
		${removeAttributeString}
		if (!${querySelector.split(':')[1]}HydartionFunction) return;
		e.addEventListener('${eventListenerName}', () => {
			eval(${querySelector.split(':')[1]}HydartionFunction);
		});
	});`;
	return script;
}

export async function renderSSRHydrationCode(template: string, reduceJavascript = false) {
	const dom = new JSDOM(template);
	let script = '';

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
			const { getAppState, initAppState } = await import('/src/main.ts');
			await initAppState();
			const appState = getAppState();
			` + ReactifyTemplate.toString() + 'ReactifyTemplate(appState);';
	}

	if (template.includes('d-if')) {
		const conditionalElms = Array.from(dom.window.document.querySelectorAll('*[d-if]'));
		if (conditionalElms.length === 0) return;
		conditionalElms.forEach(async (e: Element) => {
			const condition = e.getAttribute('d-if');
			e.removeAttribute('d-if');

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

			const uniqueSelector = Math.floor(Math.random() * 1000000).toString();
			e.setAttribute('uuid', uniqueSelector);
			script += 'function resetHTML() {';
			script += `document.querySelector('*[uuid="${uniqueSelector}"]').innerHTML = '<!-- d-if -->';`;
			const sublingUUIDMap = new Map();
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm) return;
				const siblingUniqueSelector = Math.floor(Math.random() * 1000000).toString() + '-' + uniqueSelector;
				elm.setAttribute('uuid', siblingUniqueSelector);
				script += `document.querySelector('*[uuid="${siblingUniqueSelector}"').innerHTML = '<!-- d-if -->';`;
				sublingUUIDMap[i.toString()] = siblingUniqueSelector;
			});
			script += '}';

			let ifStatement = `if (${condition}) {
				document.querySelector('*[uuid="${uniqueSelector}"').innerHTML = "${e.innerHTML}"
        } `;

			siblingConditionalElms.forEach((element, i) => {
				if (!element) return;
				const siblingHTML = element.innerHTML;
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

				const siblingUuid = sublingUUIDMap[i.toString()];
				ifStatement = ifStatement + statementDirective + `{
					document.querySelector('*[uuid="${siblingUuid}"').innerHTML = ("${siblingHTML.toString()}")
            }`;
			});

			if (!condition) return;
			script += 'resetHTML();';
			script += `eval(\`${ifStatement}\`);`;

			if (condition.includes('appState.contents.')) {
				let reactiveProp: Array<string> | string | null | undefined = /appState\.contents\.[a-zA-Z]+/.exec(condition);
				if (!reactiveProp || !reactiveProp[0]) return;
				reactiveProp = reactiveProp[0].split('.')[2];
				if (!reactiveProp) return;
				script += `appState.listen("${reactiveProp}", () => {
				resetHTML();
				eval(\`${ifStatement}\`);
			});`;
			}
		});
	}

	if (template.includes('d-on:click')) {
		script += SSRHydrateElement('*[d-on:click]', 'click');
	}

	if (template.includes('d-on:mouseDown')) {
		script += SSRHydrateElement('*[d-on:mouseDown]', 'mousedown');
	}

	if (template.includes('d-on:mouseUp')) {
		script += SSRHydrateElement('*[d-on:mouseUp]', 'mouseup');
	}

	if (template.includes('d-model')) {
		if (!script.includes('const { getAppState, initAppState } = ')) script += 'const { getAppState , initAppState } = await import(\'/src/main.ts\');';
		if (!script.includes('const appState =')) script += 'await initAppState();\nconst appState = getAppState();';
		script += hydrateModelAttributes.toString() + 'hydrateModelAttributes(appState);';
	}

	// check if there are links to hydrate
	if (template.includes('<a') && !reduceJavascript) {
		script += `
			const anchorElms = document.querySelectorAll('a');
			anchorElms.forEach((e) => {
				if (e.href === window.location.href) {
					e.setAttribute('link:active', '');
					e.setAttribute('tabindex', '-1');
				}
			}); `;
	}

	if (template.includes('d-on:keydown.')) {
		script += hydrateKeyDown.toString() + 'hydrateKeyDown();';
	}

	if (template.includes('d-on:pointerEnter')) {
		script += SSRHydrateElement('*[d-on:pointerEnter]', 'pointerenter');
	}

	if (template.includes('d-on:pointerExit')) {
		script += SSRHydrateElement('*[d-on:pointerExit]', 'pointerleave');
	}

	template = dom.window.document.body.innerHTML;

	return { script, template };
}