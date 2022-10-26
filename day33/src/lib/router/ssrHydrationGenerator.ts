export async function renderSSRHydrationCode(template: string) {
	let script = '';

	if (template.includes('appState.contents.') || template.includes('data-token')) {
		script += `
		const { getAppState, initAppState } = await import('/src/main.ts');
		await initAppState();
		const appState = getAppState();
		Object.keys(appState.contents).forEach((e) => {
			if (e === undefined) return;
			// here we check for elements with the name of "data-token-<hex code of the item name>"
			const uuid = e.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
			const listeningElements = document.querySelectorAll(\`[\${'data-token-' + uuid}]\`);
			listeningElements.forEach((elm) => {
				if (elm.parentElement?.getAttribute('d-once') !== null) {
					elm.parentElement?.removeAttribute('d-once');
					return;
				}
	
				if (elm.parentElement?.getAttribute('d-html') !== null) {
					appState.listen(e, (change) => elm.innerHTML = change);
					elm.parentElement?.removeAttribute('d-html');
				} else {
					appState.listen(e, (change) => elm.textContent = change);
				}
			});
		});
		`;
	}

	if (template.includes('d-on:click')) {
		script += `
		const elms = document.querySelectorAll('*[d-on\\\\3A click]');
		elms.forEach((e) => {
			const clickFunction = e.getAttribute('d-on:click');
			e.removeAttribute('d-on:click');
			if (!clickFunction) return;
			e.addEventListener('click', () => {
				eval(clickFunction);
			});
		});
		`;
	}

	if (template.includes('d-if')) {
		script += `
		const conditionalElms = document.querySelectorAll('*[d-if]');
	conditionalElms.forEach(async (e) => {
		const condition = e.getAttribute('d-if');

		const siblingConditionalElms = [];
		// recursively check for subsequent elements with the d-else of d-else-if attribute
		function checkForConditionSibling(elm) {
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

		let ifStatement = \`if (!!eval(condition)) {
			e.innerHTML = originalHTML
		} \`;

		for (let i = 0; i < siblingConditionalElms.length; i++) {
			const element = siblingConditionalElms[i];
			if (!element) return;
			const originHTML = element.innerHTML;
			element.innerHTML = '<!-- d-if -->';
			let statementDirective = 'else';
			if (element.getAttribute('d-else-if') !== null) {
				statementDirective = 'else if';
			}
			const condition = eval('element.getAttribute(\\'d-\\' + statementDirective.split(\\' \\').join(\\'-\\'))');

			if (statementDirective == 'else if') {
				statementDirective = 'else if (' + condition + ')';
			}

			ifStatement = ifStatement + statementDirective + \`{
			siblingConditionalElms[\${ i }].innerHTML = "\${originHTML}"
		} \`;
		}

		e.removeAttribute('d-if');
		const originalHTML = e.innerHTML;
		if (!condition || originalHTML == undefined) return;
		if (condition.includes('appState.contents.')) {
			let reactiveProp = /appState\\.contents\\.[a-zA-Z]+/.exec(condition);
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

	const pointerEnterElms = document.querySelectorAll('*[d-on\\\\3A pointerEnter]');
	pointerEnterElms.forEach((e) => {
		const enterFunction = e.getAttribute('d-on:pointerEnter');
		e.removeAttribute('d-on:pointerEnter');
		if (!enterFunction) return;
		e.addEventListener('pointerenter', () => {
			eval(enterFunction);
		});
	});

	const pointerExitElms = document.querySelectorAll('*[d-on\\\\3A pointerExit]');
	pointerExitElms.forEach((e) => {
		const exitFunction = e.getAttribute('d-on:pointerExit');
		e.removeAttribute('d-on:pointerExit');
		if (!exitFunction) return;
		e.addEventListener('pointerleave', () => {
			eval(exitFunction);
		});
	});
		`;
	}

	if (template.includes('d-on:mouseDown')) {
		script += `
		const mouseDownElms = document.querySelectorAll('*[d-on\\\\3A mouseDown]');
	mouseDownElms.forEach((e) => {
		const downFunction = e.getAttribute('d-on:mouseDown');
		e.removeAttribute('d-on:mouseDown');
		if (!downFunction) return;
		e.addEventListener('mousedown', () => {
			eval(downFunction);
		});
	});`;
	}

	if (template.includes('d-on:mouseUp')) {
		script += `
		const mouseUpElms = document.querySelectorAll('*[d-on\\\\3A mouseUp]');
	mouseUpElms.forEach((e) => {
		const dupFunction = e.getAttribute('d-on:mouseUp');
		e.removeAttribute('d-on:mouseUp');
		if (!dupFunction) return;
		e.addEventListener('mouseup', () => {
			eval(dupFunction);
		});
	});`;
	}

	if (template.includes('d-model')) {
		if (!script.includes('const { getAppState, initAppState } = ')) script += 'const { getAppState , initAppState} = await import(\'/src/main.ts\');';
		if (!script.includes('const appState =')) script += 'await initAppState();\nconst appState = getAppState();';
		script += `
		const modelElms = document.querySelectorAll('input[d-model], textarea[d-model]');
	modelElms.forEach((e) => {
		const modelName = e.getAttribute('d-model');
		if (!modelName) return;
		e.addEventListener('input', (input) => {
			const target = input.target;
			appState.contents[modelName] = target.value;
		});
	});`;
	}

	// check if there are links to prefetch
	if (template.includes('<a ') && template.includes('client:prefetch')) {
		script += `
		const anchorElms = document.querySelectorAll('a');
		const linkPrefetcher = await import('/src/lib/router/linkPrefetcher.ts');
		linkPrefetcher.default(anchorElms);`;
	}

	if (template.includes('d-on:keydown.')) {
		script += `
		document.body.querySelectorAll('*').forEach((e) => {
			for (let i = 0; i < e.attributes.length; i++) {
				const item = e.attributes.item(i).name;
				if (!item) return;
				if (item.startsWith('d-on:keydown')) {
					const key = item.split('.')[1].toLowerCase();
					let correctedKey = '';
					if (key && key.length > 1) {
						key.split('').forEach((e, i, arr) => {
							if (i === 0) {
								arr[i] = e.toUpperCase();
							}
							correctedKey += arr[i];
						});
					}
					e.addEventListener('keydown', (keydown) => {
						const keyboardEvent = keydown;
						if (keyboardEvent.key == correctedKey) {
							const itemCode = e.getAttribute(item);
							if (!itemCode) return;
							eval(itemCode);
						}
					});
				}
			}
		});`;
	}

	return script;
}