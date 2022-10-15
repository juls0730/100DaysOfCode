export const compileToString = async (template: string) => {
	let styles = '';

	function renderStyleBlock() {
		const style = parseFromRegex(template, /<style>|<\/style>/g);

		if (!style) return;

		style.map(async (style, i, arr) => {
			if (!style || !arr[i + 2]) return;
			if (style.startsWith('<style>') && arr[i + 2]?.startsWith('</style>')) {
				styles += arr[i + 1];
			}

			// remove the style from the body
			template = template.split('<style>' + styles + '</style>').join('');
		});
	}
	renderStyleBlock();

	let script = '';

	function renderScriptBlock() {
		const scriptContent = parseFromRegex(template, /<script>|<\/script>/g);

		if (!scriptContent) return;

		scriptContent.map(async (scriptData, i, arr) => {
			if (!scriptData || !arr[i + 2]) return;
			if (scriptData.startsWith('<script') && arr[i + 2]?.startsWith('</script>')) {
				script += arr[i + 1];
			}

			// remove the style from the body
			template = template.split('<script>' + script + '</script>').join('');
		});
	}

	renderScriptBlock();

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


	return { fnStr, styles, script };
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

export const render = (template: string) => {
	return compileToString(template);
};