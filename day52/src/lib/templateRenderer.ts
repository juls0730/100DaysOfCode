export const compileToString = async (template: string) => {
	let styles = '';

	const style = parseFromRegex(template, /<style[\s\S]*?>[\s\S]*?<\/style>/gi);

	if (style) {
		style.map(async (styleData) => {
			if (!styleData) return;
			if (styleData.startsWith('<style') && styleData.endsWith('</style>')) {
				styles += styleData.split('<style')[1]?.split('>')[1]?.split('</style')[0];
			}

			// remove the style from the body
			template = template.split('<style>' + styles + '</style>').join('');
		});
	}

	let scriptInjection = '';
	let script = '';
	const meta = { layout: 'default', reduceJavascript: false };

	const scriptContent = parseFromRegex(template, /<script>[\s\S]*?<\/script>/gi);

	if (scriptContent) {
		scriptContent.map(async (scriptData) => {
			if (!scriptData) return;
			if (scriptData.startsWith('<script>') && scriptData.endsWith('</script>')) {
				// if (scriptData.includes('appState.contents.')) {
				// 	scriptInjection += 'const { getAppState, initAppState } = await import("/src/main.ts");\nasync initAppState();\nconst appState = getAppState();';
				// }
				const metaElms = parseFromRegex(scriptData, /definePageMeta\({(.*?)}\)(;){0,1}/g);
				metaElms.forEach((metaElm: string | undefined) => {
					if (!metaElm || !scriptData) return;
					if (metaElm.startsWith('definePageMeta({')) {
						scriptData = scriptData.split(metaElm).join('');
						template = template.split(metaElm).join('');
						let metaObjString = metaElm.split('(')[1]?.split(')')[0];
						if (!metaObjString) return;
						metaObjString = metaObjString.replaceAll(' ', '').replaceAll('{', '{\'').replaceAll(':', '\':').replaceAll(',', ',\'').replaceAll('\'', '"');
						const newMeta = JSON.parse(metaObjString);
						Object.keys(newMeta).forEach((key) => {
							newMeta[key] = meta[key];
						});
					}
				});

				if (scriptData.includes('getCookie')) {
					scriptInjection += 'const { getCookie } = await import("/src/lib/cookieManager.ts");';
				}

				if (scriptData.includes('setCookie')) {
					scriptInjection += 'const { setCookie } = await import("/src/lib/cookieManager.ts");';
				}

				if (scriptData.includes('isSSR()')) {
					scriptInjection += 'const { isSSR } = await import("/src/main.ts");';
				}

				script += scriptData.split('<script>')[1]?.split('</script>')[0];
				const minishScript = script.replace(/[\n\r]/g, '').trim();
				if (!minishScript) return;
				template = template.split('<script>' + script + '</script>').join('');
				scriptInjection += 'document.addEventListener(\'router:client:load\', () => {\n' + minishScript + '\n}, { once: true });';
			}

			// remove the script from the body
			template = template.split('<script>' + script + '</script>').join('');
			script = '';
		});
	}

	const scriptContentSetup = parseFromRegex(template, /<script setup[\s\S]*?>[\s\S]*?<\/script>/gi);
	let setupScriptInjection = '';
	let setupScript = '';
	if (scriptContentSetup) {
		scriptContentSetup.map(async (scriptData) => {
			if (!scriptData) return;
			if (scriptData.startsWith('<script setup') && scriptData.endsWith('</script>')) {
				// if (scriptData.includes('appState.contents.') && !scriptInjection.includes('initAppState')) {
				// 	scriptInjection = 'const { getAppState, initAppState } = await import("/src/main.ts"); //aaahahahahahahah' + scriptInjection;
				// }

				if (scriptData.includes('getCookie')) {
					setupScriptInjection += 'const { getCookie } = await import("/src/lib/cookieManager.ts");';
				}

				if (scriptData.includes('setCookie')) {
					setupScriptInjection += 'const { setCookie } = await import("/src/lib/cookieManager.ts");';
				}

				if (scriptData.includes('isSSR()')) {
					setupScriptInjection += 'const { isSSR } = await import("/src/main.ts");';
				}

				setupScript += scriptData.split('<script setup>')[1]?.split('</script>')[0];
				setupScriptInjection = scriptData.split('<script setup>')[1]?.split('</script>')[0] + setupScriptInjection;
			}

			// remove the script from the body
			template = template.split('<script setup>' + setupScript + '</script>').join('');
		});
	}

	let headInjection = '';
	let head = '';
	if (import.meta.env.SSR) {
		const headInjectionContent = parseFromRegex(template, /<devto:head[\s\S]*?>[\s\S]*?<\/devto:head>/gi);
		if (headInjectionContent) {
			headInjectionContent.map(async (headData) => {
				if (!headData) return;
				if (headData.startsWith('<devto:head>') && headData.endsWith('</devto:head>')) {
					const newHeadContent = headData.split('<devto:head>')[1]?.split('</devto:head>')[0];
					if (!newHeadContent) return;
					head = newHeadContent;
					const elements = newHeadContent.split('\n');
					elements.forEach((e, i, arr) => {
						if (!e.trim()) return;
						function isCompleteElement() {
							if (!e.endsWith('>')) {
								return false;
							} else {
								return true;
							}
						}
						if (!isCompleteElement()) {
							arr[i] = '';
							arr[i + 1] = e + arr[i + 1];
						}
						if (!isCompleteElement()) return;
						headInjection += e;
					});
				}
			});
			template = template.split('<devto:head>' + head + '</devto:head>').join('');
		}
	}


	if (template.includes('getCookie') && !script.includes('getCookie')) {
		scriptInjection += 'const getCookie = await import("/src/lib/cookieManager.ts");';
	}

	if (template.includes('setCookie') && !script.includes('setCookie')) {
		scriptInjection += 'const { setCookie } = await import("/src/lib/cookieManager.ts");';
	}

	const ast: (string | undefined)[] = parseFromRegex(template, /{(.*?)}/g);
	let fnStr = '``';

	if (!ast) return;

	ast.map(async (t: string | undefined) => {
		if (!t) return;
		// checking to see if it is an interpolation
		if (t.startsWith('{') && t.endsWith('}')) {
			// TODO: rewrite comment
			const bracketVariable = t.split(/{|}/).filter(Boolean)[0]?.trim();
			if (!bracketVariable) return;
			const parentElement = fnStr.split(t)[0]?.split('>');
			if (!parentElement || !parentElement[parentElement.length - 2] || typeof parentElement[parentElement.length - 2] == 'undefined') return;
			const isRawHTML = parentElement[parentElement.length - 2]?.includes('d-html');
			if (bracketVariable.startsWith('appState.contents.')) {
				const uuid = bracketVariable.substring(bracketVariable.length, 18).split('').map((c: string) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
				fnStr = fnStr.substring(0, fnStr.length - 1) + `<span data-token-${uuid}>\``;
			} else {
				fnStr = fnStr.substring(0, fnStr.length - 1) + '<span>`';
			}
			let runVar = `((${bracketVariable}).toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'))`;

			if (isRawHTML) {
				runVar = `(${bracketVariable})`;
			}

			fnStr += `+ (${runVar})` + '+`</span>`';
		} else {
			// append the string to the fnStr
			fnStr += `+\`${t}\``;
		}
	});

	if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD && !import.meta.env.SSR) {
		console.groupCollapsed('Compiled tempalte to String');
		console.info('Template String: ' + fnStr);
		console.groupEnd();
	}


	return { fnStr, styles, script: scriptInjection, setupScript: setupScriptInjection, head: headInjection, layouts: meta };
};

const parseFromRegex = (template: string, regex: RegExp) => {
	let result = regex.exec(template);
	regex.lastIndex = 0;
	const arr = [];
	let firstPos;

	while (result) {
		firstPos = result.index;
		if (firstPos !== 0) {
			arr.push(template.substring(0, firstPos));
			template = template.slice(firstPos);
		}

		arr.push(result[0]);
		template = template.slice(result[0]?.length);
		result = regex.exec(template);
		regex.lastIndex = 0;
	}

	if (template) arr.push(template);
	return arr;
};