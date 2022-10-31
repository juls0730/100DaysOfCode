import { ReactifyTemplate, hydrateOnClick, hydrateIfAttributes, hydrateMouseDown, hydrateMouseUp, hydrateModelAttributes, hydrateKeyDown, hydratePointerExit, hydratePointerEnter } from './hydrationManager';

export async function renderSSRHydrationCode(template: string) {
	let script = '';

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
		const { getAppState, initAppState } = await import('/src/main.ts');
		await initAppState();
		const appState = getAppState();
		` + ReactifyTemplate.toString() + 'ReactifyTemplate(appState);';
	}

	if (template.includes('d-on:click')) {
		script += hydrateOnClick.toString() + 'hydrateOnClick();';
	}

	if (template.includes('d-if')) {
		script += hydrateIfAttributes.toString() + 'hydrateIfAttributes();';
	}

	if (template.includes('d-on:mouseDown')) {
		script += hydrateMouseDown.toString() + 'hydrateMouseDown();';
	}

	if (template.includes('d-on:mouseUp')) {
		script += hydrateMouseUp.toString() + 'hydrateMouseUp();';
	}

	if (template.includes('d-model')) {
		if (!script.includes('const { getAppState, initAppState } = ')) script += 'const { getAppState , initAppState } = await import(\'/src/main.ts\');';
		if (!script.includes('const appState =')) script += 'await initAppState();\nconst appState = getAppState();';
		script += hydrateModelAttributes.toString() + 'hydrateModelAttributes(appState);';
	}

	// check if there are links to prefetch
	if (template.includes('<a ') && template.includes('client:prefetch')) {
		script += `
		const anchorElms = document.querySelectorAll('a');
		const linkPrefetcher = await import('/src/lib/router/linkPrefetcher.ts');
		linkPrefetcher.default(anchorElms);`;
	}

	if (template.includes('d-on:keydown.')) {
		script += hydrateKeyDown.toString() + 'hydrateKeyDown();';
	}

	if (template.includes('d-on:pointerEnter')) {
		script += hydratePointerEnter.toString() + 'hydratePointerEnter();';
	}

	if (template.includes('d-on:pointerExit')) {
		script += hydratePointerExit.toString() + 'hydratePointerExit();';
	}

	return script;
}