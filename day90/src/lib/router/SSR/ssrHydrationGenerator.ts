import { ReactifyTemplate, hydrateModelAttributes, hydrateKeyDown } from '../hydrationManager';
import { JSDOM } from 'jsdom';
import * as terser from 'terser';
import { Reactive } from '../../ReactiveObject';
import { getAppState, initAppState } from '../../../main';

const appState = await getAppState();

async function minify(code: string) {
	try {
		code = (await terser.minify(code)).code;
	} catch (err) {
		const { message, line, col, pos } = err;
		console.log({ message, line, col, pos, code });
	}
	return code;
}

export async function renderSSRHydrationCode(template: string, reduceJavascript = false, serverSideSPALikeRouting = true) {
	const dom: JSDOM = new JSDOM(template);
	let script = '';
	const domElements = Array.from(dom.window.document.body.querySelectorAll('*'));

	domElements.forEach((e) => {
		const hexCode = Math.random().toString(16).substring(2, 8);
		e.setAttribute('data-d', hexCode);
	});

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
			const { getAppState, initAppState } = await import('/src/main.ts');await initAppState();const appState = getAppState();
			` + ReactifyTemplate.toString() + 'ReactifyTemplate(appState);';
	}

	if (template.includes('d-if')) {
		const conditionalElms = Array.from(dom.window.document.querySelectorAll('*[d-if]'));
		if (conditionalElms.length === 0) return;
		await Promise.all(conditionalElms.map(async (e: Element, i) => {
			const { document } = dom.window;
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

			if (!script.includes('const hiddenTag = ')) {
				script += 'const hiddenTag = "<!-- d-if -->";';
			}
			script += `function resetHTML_${i}() {`;
			script += `document.querySelector('*[uuid="${uniqueSelector}"]').innerHTML = hiddenTag;`;
			const siblingUUIDMap = new Map();
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm || !elm.textContent) return;
				const siblingUniqueSelector = generateLabel(elm.textContent);
				elm.setAttribute('uuid', siblingUniqueSelector);
				script += `document.querySelector('*[uuid="${siblingUniqueSelector}"').innerHTML = hiddenTag;`;
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

				if (statementDirective == 'else if') {
					statementDirective = `else if (${element.getAttribute('d-else-if')})`;
					element.removeAttribute('d-else-if');
				}

				const siblingUuid = siblingUUIDMap[i.toString()];
				ifStatement = ifStatement + statementDirective + `{
					document.querySelector('*[uuid="${siblingUuid}"').innerHTML = ("${siblingHTML.toString()}")
            }`;
			});

			ifStatement = await minify(ifStatement, condition);

			script += `const ifStatement_${i} = \`${ifStatement}\`;
			resetHTML_${i}();
			eval(ifStatement_${i});`;

			if (condition && condition.includes('appState.contents.')) {
				let reactiveProp: Array<string> | string | null | undefined = /appState\.contents\.[a-zA-Z]+/.exec(condition);
				if (!reactiveProp || !reactiveProp[0]) return;
				reactiveProp = reactiveProp[0].split('.')[2];
				if (!reactiveProp) return;
				script += `appState.listen("${reactiveProp}", () => {
				resetHTML_${i}();
				eval(ifStatement_${i});
			});`;
			}

			/* reset HTML */
			document.querySelector('*[uuid="' + uniqueSelector + '"]').innerHTML = '<!-- d-if -->';
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm || !elm.textContent) return;
				const siblingUniqueSelector = siblingUUIDMap[i.toString()];
				document.querySelector(`*[uuid="${siblingUniqueSelector}"`).innerHTML = '<!-- d-if -->';
			});

			eval(ifStatement);
		}));
	}

	if (template.includes('d-on:')) {
		const elements = Array.from(dom.window.document.body.querySelectorAll('*'));

		const eventElements = elements.filter((e) => {
			return Array.from(e.attributes).some(attr => attr.name.startsWith('d-on:'));
		});

		eventElements.forEach((e) => {
			const label = e.getAttribute('data-d');

			const dOnAttrs = Array.from(e.attributes).filter(attr => attr.name.startsWith('d-on:'));

			dOnAttrs.forEach((attr) => {
				const [eventType, ...modifiers] = attr.name.split(':')[1].split('.');
				const inlineCode = attr.value;
				const isKeyboardEvent = (eventType.startsWith('key')) ? true : false;
				const keyName = (isKeyboardEvent && modifiers[0]) ? modifiers[0].charAt(0).toUpperCase() + modifiers[0].slice(1).toLowerCase() : '';

				e.removeAttribute(attr.name);

				script += `document.querySelector('*[data-d="${label}"]').addEventListener("${eventType}", () => {`;

				if (isKeyboardEvent) {
					script += `
					let eventKey = (event.key === ' ') ? 'Space' : 'event.key';
					const firstLetter = eventKey.split('')[0];
					eventKey = firstLetter?.toUpperCase() + eventKey.slice(1).toLowerCase();
					`;
				}
				// god forgive me for what I'm about to do
				for (let i = 0; i < modifiers.length; i++) {
					const modifier = modifiers[i];

					if (modifier === 'stop') {
						script += 'event.stopPropagation();';
					}

					if (modifier === 'prevent') {
						script += 'event.preventDefault();';
					}

					if (modifier === 'self') {
						script += 'if (e !== event.target) return;';
					}
				}

				if (!isKeyboardEvent || !keyName) {
					script += `${inlineCode} `;
				} else {
					script += `
					if (eventKey === "${keyName}") {
						${inlineCode} 
					}`;
				}

				script += `}, { ${(modifiers.some(mod => mod === 'once')) ? 'once: true,' : ''} 
				${(modifiers.some(mod => mod === 'capture')) ? 'capture: true,' : ''} 
			${(modifiers.some(mod => mod === 'passive')) ? 'passive: true,' : ''} });`;
			});
		});
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


		Array.from(dom.window.document.querySelectorAll('*')).forEach((e: Element, i) => {
			const bindElms = Array.from(e.attributes).filter((arrElm: Attr) => {
				return arrElm.name.startsWith('d-bind:') || arrElm.name.startsWith(':');
			});

			if (bindElms.length === 0) return;
			bindElms.forEach(async (attr: Attr, attri) => {
				const item = attr.name;
				const key = item.split(':')[1]?.toLowerCase();
				const originalValue = '(' + attr.value + ')';
				let currentBinding = '';

				e.removeAttribute(item);

				async function setAttribute() {

					if (!key) return;
					let value = 'return "' + originalValue + '"';
					const attribute = e.getAttribute(key) || '';
					if (value.includes('(') || value.includes(')') || value.includes('?') || value.includes(':')) {
						value = eval(originalValue);
					}
					if (value == undefined || attribute == undefined) return;
					if (attribute) {
						const originalAttributeValue = (attribute.toString()).split(`${currentBinding}`).join('');
						currentBinding = value;
						value = originalAttributeValue + ' ' + value;
					}
					e.setAttribute(key, value);
				}

				if (attri === 0) {
					script += `const originalValue_${i} = "${originalValue}";
				let currentBinding_${i} = "${currentBinding}";`;
				}

				if (originalValue.includes('appState')) {
					const label = e.getAttribute('data-d');
					script += `function setAttribute_${attri}() {
						let value = \`return '${originalValue}'\`;
						const attribute = \`${e.getAttribute(key)}\`;
						if (value.includes('(') || value.includes(')') || value.includes('?') || value.includes(':')) {
							value = eval(originalValue_${i});
						}
						if (attribute) {
							const originalAttributeValue = (attribute.toString()).split(\`${currentBinding}\`).join('');
							currentBinding_${i} = value;
							value = originalAttributeValue + ' ' + value;
						}
						document.querySelector('*[data-d="${label}"]').setAttribute("${key}", value);
					}`;

					originalValue.split(' ').forEach((value) => {
						const propName = value.split('appState.contents.')[1];
						if (!propName || !value.includes('appState')) return;
						script += `appState.listen("${propName.replace(')', '')}", () => setAttribute_${attri}());`;
					});
				}

				setAttribute();

			});
		});
	}

	if (template.includes('d-on:keydown.')) {
		script += hydrateKeyDown.toString() + 'hydrateKeyDown(appState, document.getElementById("app"));';
	}

	if (script.includes('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();')) {
		script = script.replace('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();', Reactive.toString() + 'let appState;' + initAppState.toString() + ' await initAppState();').replace('__vite_ssr_import_0__.', '').replace('__vite_ssr_dynamic_import__', 'import');
	}

	template = dom.window.document.body.innerHTML;

	return { script, template };
}