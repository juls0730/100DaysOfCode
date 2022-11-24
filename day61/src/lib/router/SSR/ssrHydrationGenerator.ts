import { ReactifyTemplate, hydrateIfAttributes, hydrateModelAttributes, hydrateKeyDown } from '../hydrationManager';

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
	let script = '';

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
		const { getAppState, initAppState } = await import('/src/main.ts');
		await initAppState();
		const appState = getAppState();
		` + ReactifyTemplate.toString() + 'ReactifyTemplate(appState);';
	}

	if (template.includes('d-on:click')) {
		script += SSRHydrateElement('*[d-on:click]', 'click');
	}

	if (template.includes('d-if')) {
		script += hydrateIfAttributes.toString() + 'hydrateIfAttributes(appState);';
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
		});`;
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

	return script;
}