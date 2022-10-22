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

	const scriptContent = parseFromRegex(template, /<script[\s\S]*?>[\s\S]*?<\/script>/gi);

	if (scriptContent) {
		scriptContent.map(async (scriptData) => {
			if (!scriptData) return;
			if (scriptData.startsWith('<script') && scriptData.endsWith('</script>')) {
				if (scriptData.includes('appState.contents.')) {
					scriptInjection += 'const { appState } = await import("/src/main.ts");';
				}

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
				scriptInjection += 'document.addEventListener(\'router:client:load\', () => {\n' + scriptData.split('<script>')[1]?.split('</script>')[0] + '\n});';
			}

			// remove the script from the body
			template = template.split('<script>' + script + '</script>').join('');
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

	const ast: Array<string> | undefined = parseFromRegex(template, /{(.*?)}/g);
	let fnStr = '``';

	if (!ast) return;


	ast.map(async (t: string) => {
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


	return { fnStr, styles, script: scriptInjection, head: headInjection };
};

const parseFromRegex = (template: string, regex: RegExp) => {
	let result = regex.exec(template);
	const arr = [];
	let firstPos;

	while (result) {
		firstPos = result.index;
		if (firstPos !== 0) {
			arr.push(template.substr(0, firstPos));
			template = template.slice(firstPos);
		}

		if (!result[0]) return;

		arr.push(result[0]);
		template = template.slice(result[0].length);
		result = regex.exec(template);
	}

	if (template) arr.push(template);
	return arr;
};