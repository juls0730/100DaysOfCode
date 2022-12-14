import { ReactifyTemplate, hydrateModelAttributes, hydrateKeyDown, hydrateBindElements } from '../hydrationManager';
import { JSDOM } from 'jsdom';
import { Reactive } from '../../ReactiveObject';
import { initAppState } from '../../../main';

function SSRHydrateElement(querySelector: string, eventListenerName: string, removeAttribute?: boolean) {
	const queryName: Array<string> | null = /(?<=\[).+?(?=\])/.exec(querySelector);

	if (!queryName || !queryName[0]) return;

	const querySelectorAll = (querySelector.replace(':', '\\\\3A '));
	querySelector = queryName[0];
	let removeAttributeString = '';

	if (removeAttribute === undefined || removeAttribute === true) {
		removeAttributeString = `e.removeAttribute('${querySelector}');`;
	}

	const queryType = querySelector.split(':')[1];
	const script = `const ${queryType}Elms = document.querySelectorAll('${querySelectorAll}');
	${queryType}Elms.forEach((e) => {
		const ${queryType}HydrationFunction = e.getAttribute('${querySelector}');
		${removeAttributeString}
		if (!${queryType}HydrationFunction) return;
		e.addEventListener('${eventListenerName}', () => {
			eval(${queryType}HydrationFunction);
		});
	});`;

	return script;
}

export async function renderSSRHydrationCode(template: string, reduceJavascript = false, serverSideSPALikeRouting = true) {
	const dom = new JSDOM(template);
	let script = '';

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
			const { getAppState, initAppState } = await import('/src/main.ts');await initAppState();const appState = getAppState();
			` + ReactifyTemplate.toString() + 'ReactifyTemplate(appState);';
	}

	if (template.includes('d-if')) {
		const conditionalElms = Array.from(dom.window.document.querySelectorAll('*[d-if]'));
		if (conditionalElms.length === 0) return;
		conditionalElms.forEach(async (e: Element, i) => {
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

			function generateLabel(textContent: string, count?: number) {
				if (count === undefined) count = 1;
				let label = '';
				if (script.includes(textContent + '-' + count) || template.includes(textContent + '-' + count)) {
					label = generateLabel(textContent, count + 1);
				} else {
					label = textContent + '-' + count.toString();
				}
				return label;
			}

			if (!e.textContent) return;
			const uniqueSelector = generateLabel(e.textContent);
			e.setAttribute('uuid', uniqueSelector);

			script += `function resetHTML_${i}() {`;
			script += `document.querySelector('*[uuid="${uniqueSelector}"]').innerHTML = '<!-- d-if -->';`;
			const siblingUUIDMap = new Map();
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm || !elm.textContent) return;
				const siblingUniqueSelector = generateLabel(elm.textContent);
				elm.setAttribute('uuid', siblingUniqueSelector);
				script += `document.querySelector('*[uuid="${siblingUniqueSelector}"').innerHTML = '<!-- d-if -->';`;
				siblingUUIDMap[i.toString()] = siblingUniqueSelector;
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

				const siblingUuid = siblingUUIDMap[i.toString()];
				ifStatement = ifStatement + statementDirective + `{
					document.querySelector('*[uuid="${siblingUuid}"').innerHTML = ("${siblingHTML.toString()}")
            }`;
			});

			if (!condition) return;
			script += `resetHTML_${i}();`;
			script += `eval(\`${ifStatement}\`);`;

			if (condition.includes('appState.contents.')) {
				let reactiveProp: Array<string> | string | null | undefined = /appState\.contents\.[a-zA-Z]+/.exec(condition);
				if (!reactiveProp || !reactiveProp[0]) return;
				reactiveProp = reactiveProp[0].split('.')[2];
				if (!reactiveProp) return;
				script += `appState.listen("${reactiveProp}", () => {
				resetHTML_${i}();
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
		if (!script.includes('const { getAppState, initAppState } = ')) script += 'const { getAppState, initAppState } = await import(\'/src/main.ts\');';
		if (!script.includes('const appState =')) script += 'await initAppState();const appState = getAppState();';
		script += hydrateModelAttributes.toString() + 'hydrateModelAttributes(appState);';
	}

	// check if there are links to hydrate
	if (template.includes('<a') && (!reduceJavascript || serverSideSPALikeRouting)) {
		script += `const anchorElms = document.querySelectorAll('a');
		anchorElms.forEach((e) => {`;

		if (template.includes('client:prefetch') && serverSideSPALikeRouting) script += `e.addEventListener('click', async (event) => {
			console.log(event)
			const route = event.target.href;
			if (route === window.location.pathname) return;
			if (event.ctrlKey) return;
			event.preventDefault();
			if (!('history' in window)) return;
			history.pushState('', '', route);
			await fetch(route)
			.then((response) => response.text())
			.then((data) => {
				document.write(data);
				document.close();
			});
			return false;
		}); e.removeAttribute('client:prefetch');`;

		if (!reduceJavascript) script += `if (e.href === window.location.href) {
					e.setAttribute('link:active', '');
					e.setAttribute('tabindex', '-1');
				}`;
		script += '}); ';
	}

	if (template.includes('d-bind:') || template.includes(' :')) {
		if (!script.includes('const { getAppState, initAppState } = ')) script += 'const { getAppState, initAppState } = await import(\'/src/main.ts\');';
		if (!script.includes('const appState =')) script += 'await initAppState();const appState = getAppState();';
		script += hydrateBindElements.toString() + 'hydrateBindElements(appState, document.getElementById("app"));';
	}

	if (template.includes('d-on:keydown.')) {
		script += hydrateKeyDown.toString() + 'hydrateKeyDown(appState, document.getElementById("app"));';
	}

	if (template.includes('d-on:pointerEnter')) {
		script += SSRHydrateElement('*[d-on:pointerEnter]', 'pointerenter');
	}

	if (template.includes('d-on:pointerExit')) {
		script += SSRHydrateElement('*[d-on:pointerExit]', 'pointerleave');
	}

	if (script.includes('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();')) {
		script = script.replace('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();', Reactive.toString() + 'let appState;' + initAppState.toString() + ' await initAppState();').replace('__vite_ssr_import_0__.', '').replace('__vite_ssr_dynamic_import__', 'import');
	}

	template = dom.window.document.body.innerHTML;

	return { script, template };
}