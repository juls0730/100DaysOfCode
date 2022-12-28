import { JSDOM } from 'jsdom';
import * as terser from 'terser';
import { Reactive } from '../../ReactiveObject';
import { getAppState, initAppState } from '../../../main';
import { LRUCache } from '../../lruCache';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

	if (template.includes('data-token')) {
		script += 'const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();';
		const reactiveElms = Array.from(dom.window.document.querySelectorAll('span'));
		if (reactiveElms.length === 0) return;
		reactiveElms.forEach((e) => {
			const label = e.getAttribute('data-d');
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
					script += `appState.listen("${decodedUuid}", (change) => document.querySelector("[data-d='${label}']").innerHTML = change);`;
					return;
				}

				script += `appState.listen("${decodedUuid}", (change) => document.querySelector("[data-d='${label}']").textContent = change);`;
			});
		});
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

			const uniqueSelector = e.getAttribute('data-d');

			if (!script.includes('const hiddenTag = ')) {
				script += 'const hiddenTag = "<!-- d-if -->";';
			}
			script += `function resetHTML_${i}() {`;
			script += `document.querySelector('*[data-d="${uniqueSelector}"]').innerHTML = hiddenTag;`;
			const siblingUUIDMap = new Map();
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm || !elm.textContent) return;
				const siblingUniqueSelector = elm.getAttribute('data-d');
				script += `document.querySelector('*[data-d="${siblingUniqueSelector}"').innerHTML = hiddenTag;`;
				siblingUUIDMap[i.toString()] = siblingUniqueSelector;
			});
			script += '}';

			let ifStatement = `if (${condition}) {
				document.querySelector('*[data-d="${uniqueSelector}"').innerHTML = "${e.innerHTML}"
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
					document.querySelector('*[data-d="${siblingUuid}"').innerHTML = ("${siblingHTML.toString()}")
            }`;
			});

			ifStatement = await minify(ifStatement, condition);

			script += `const ifStatement_${i} = new Function('appState', \`${ifStatement}\`);
			resetHTML_${i}();
			ifStatement_${i}(appState);`;

			if (condition && condition.includes('appState.contents.')) {
				let reactiveProp: Array<string> | string | null | undefined = /appState\.contents\.[a-zA-Z]+/.exec(condition);
				if (!reactiveProp || !reactiveProp[0]) return;
				reactiveProp = reactiveProp[0].split('.')[2];
				if (!reactiveProp) return;
				script += `appState.listen("${reactiveProp}", () => {
				resetHTML_${i}();
				ifStatement_${i}(appState);
			});`;
			}

			/* reset HTML */
			document.querySelector('*[data-d="' + uniqueSelector + '"]').innerHTML = '<!-- d-if -->';
			siblingConditionalElms.forEach((elm, i) => {
				if (!elm || !elm.textContent) return;
				const siblingUniqueSelector = siblingUUIDMap[i.toString()];
				document.querySelector(`*[data-d="${siblingUniqueSelector}"`).innerHTML = '<!-- d-if -->';
			});

			eval(ifStatement);
		}));
	}

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

	const modelElements = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => attr.name.startsWith('d-model'));
	});

	modelElements.forEach((modelElement) => {
		const modelName = modelElement.getAttribute('d-model');
		modelElement.removeAttribute('d-model');
		if (modelName === undefined || modelName === null) return;

		const label = modelElement.getAttribute('data-d');
		script += `document.querySelector('*[data-d="${label}"]').addEventListener('input', (input) => {
			const target = input.target;
			appState.contents["${modelName}"] = target.value;
		});`;
	});

	const bindElements = elements.filter((e) => {
		return Array.from(e.attributes).some(attr => /^(?:d-bind:|:)/.test(attr.name));
	});

	bindElements.forEach((e, i) => {
		const modelAttrs = Array.from(e.attributes).filter(attr => attr.name.startsWith('d-bind:') || attr.name.startsWith(':'));

		modelAttrs.forEach((attr, attri) => {
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

	if (!reduceJavascript || serverSideSPALikeRouting) {
		script += 'const anchorElms = document.querySelectorAll(\'a\');';
		if (template.includes('client:prefetch') && serverSideSPALikeRouting) script += LRUCache.toString() + `let pageCache; 
		if (sessionStorage.getItem("pageCache")) {
			pageCache = new LRUCache(10, new Map(JSON.parse(sessionStorage.getItem("pageCache"))));
		} else {
			pageCache = new LRUCache(10)
		}`;
		script += 'anchorElms.forEach((e) => {';

		if (template.includes('client:prefetch') && serverSideSPALikeRouting) script += `
		e.addEventListener('click', async (event) => {
			const route = event.target.href;
			if (route === window.location.pathname) return;
			if (event.ctrlKey) return;
			event.preventDefault();
			if (!('history' in window)) return;
			history.pushState('', '', route);
			if (!pageCache.get(route)) {
				await fetch(route)
				.then((response) => response.text())
				.then((data) => {
					pageCache.set(route, data)
					sessionStorage.setItem("pageCache", JSON.stringify(Array.from(pageCache.getCache().entries())));
					document.write(data);
					document.close();
				});
			} else {
				document.write(pageCache.get(route));
				document.close();
			}
			return false;
		}); e.removeAttribute('client:prefetch');`;

		if (!reduceJavascript) script += `if (e.href === window.location.href) {
					e.setAttribute('link:active', '');
					e.setAttribute('tabindex', '-1');
				}`;
		script += '}); ';
	}

	if (script.includes('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();')) {
		script = script.replace('const { getAppState, initAppState } = await import(\'/src/main.ts\');await initAppState();const appState = getAppState();', Reactive.toString() + 'let appState;' + initAppState.toString() + ' await initAppState();').replace('__vite_ssr_import_0__.', '').replace('__vite_ssr_dynamic_import__', 'import');
	}

	template = dom.window.document.body.innerHTML;

	return { script, template };
}