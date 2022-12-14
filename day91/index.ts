import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import * as Vite from 'vite';
import cookies from 'cookie-parser';
import Cleancss from 'clean-css';
import * as terser from 'terser';
import Ip from 'ip';
import { JSDOM } from 'jsdom';
import devtoConfig from './devto.config.js';

const tags = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'decorator', 'del', 'details', 'devto:head', 'dfn', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'shadow', 'slot', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
function isHTML(tag: string) {
	return tags.indexOf(tag.trim()) > -1;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let time: number;

function parseFromRegex(template: string, regex: RegExp) {
	let result = regex.exec(template);
	regex.lastIndex = 0;
	const arr: Array<string | undefined> = [];
	let firstPos: number;

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
}

async function createServer() {
	const start = (new Date).getTime();
	const app = express();

	let basepath: string;
	(process.env.NODE_ENV == 'production') ? basepath = './' : basepath = './src/';

	app.use(express.static(__dirname + '/public', {
		maxAge: 43200
	}));
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,cache-control');
		res.setHeader('Cache-Control', 'max-age=43200, public');

		next();
	});
	app.use(cookies());

	app.use(compression({ filter: shouldCompress }));

	function shouldCompress(req: Request, res: Response) {
		if (req.headers['x-no-compression']) {
			// don't compress responses with this request header
			return false;
		}

		// fallback to standard filter function
		return compression.filter(req, res);
	}

	const config = { port: devtoConfig.port || 3000, mode: (devtoConfig.ssr) ? 'ssr' : 'spa' };

	const appType = (config.mode === 'ssr') ? 'custom' : 'spa';


	// Create Vite server in middleware mode and configure the app type as
	// 'custom', disabling Vite's own HTML serving logic so parent server
	// can take control
	const vite = await createViteServer({
		server: { middlewareMode: true, port: config.port },
		appType
	});

	const { LRUCache } = await vite.ssrLoadModule('/src/lib/lruCache.ts');
	const scriptCache = new LRUCache(10);
	const styleCache = new LRUCache(10);

	// use vite's connect instance as middleware
	// if you use your own express router (express.Router()), you should use router.use
	app.use(vite.middlewares);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function renderPage(url: string, req: Request) {
		// 1. Read index.html
		let template: string;
		let status = 200;
		template = fs.readFileSync(
			path.resolve(__dirname, 'index.html'),
			'utf-8'
		);

		let fileName: Array<string> | string = url.split('/');
		if (fileName[1] === '') {
			fileName = '/index';
		} else {
			fileName = fileName.join('/').toLowerCase().trim();
		}

		// 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
		//    also applies HTML transforms from Vite plugins, e.g. global preambles
		//    from @vitejs/plugin-react
		template = await vite.transformIndexHtml(url, template);

		// 3. Load the server entry. vite.ssrLoadModule automatically transforms
		//    your ESM source code to be usable in Node.js! There is no bundling
		//    required, and provides efficient invalidation similar to HMR.
		const { compileToString } = await vite.ssrLoadModule('/src/lib/templateRenderer');

		let pageData: string;

		let layout;
		const metaObj = { 'layout': 'default', 'reduceJavascript': false, 'suspendUntilHydrated': true, 'serverSideSPALikeRouting': true };

		try {
			layout = fs.readFileSync(
				path.resolve(__dirname, `src/layouts/${metaObj.layout}.devto`),
				'utf-8'
			);
		} catch {
			layout = '<slot />';
		}

		try {
			pageData = fs.readFileSync(
				path.resolve(__dirname, basepath + '/pages' + fileName + '.devto'),
				'utf8',
			);

			parseFromRegex(pageData, /<script>[\s\S]*?<\/script>/gi).forEach((e: string | undefined) => {
				if (!e) return;
				if (!e.startsWith('<script>') || !e.endsWith('</script>')) return;

				parseFromRegex(e, /definePageMeta\({(.*?)}\)(;){0,1}/g).forEach((metaElm: string | undefined) => {
					if (!metaElm) return;
					if (!metaElm.startsWith('definePageMeta({')) return;

					let metaObjString = metaElm.split('(')[1]?.split(')')[0];
					if (!metaObjString) return;

					metaObjString = metaObjString.replaceAll(' ', '').replaceAll('{', '{\'').replaceAll(':', '\':').replaceAll(',', ',\'').replaceAll('\'', '"');
					const newMetaObj = JSON.parse(metaObjString);
					Object.keys(newMetaObj).forEach((key) => {
						metaObj[key] = newMetaObj[key];
					});
				});
			});

			parseFromRegex(pageData, /<script serverSideScript>[\s\S]*?<\/script>/gi).forEach((e: string | undefined) => {
				if (!e) return;
				if (!e.startsWith('<script serverSideScript>') || !e.endsWith('</script>')) return;

				pageData = pageData.split(e).join('');

				const fn = e.split('<script serverSideScript>')[1]?.split('</script>')[0];

				if (!fn) return;

				eval(fn);
			});
		} catch (e) {
			status = 404;
			pageData = fs.readFileSync(
				path.resolve(__dirname, basepath + '/layouts/404.devto'),
				'utf8'
			);
		}

		pageData = layout.replaceAll('<slot />', pageData);

		function renderImageToBase64(element: string) {
			const fixedElm = element.split('>')[0];
			if (!fixedElm) return false;
			if (fixedElm.split(' ').length < 2) return false;
			if (!fixedElm.includes('image:bundle')) return false;
			let srcName = fixedElm.split('src')[1]?.split(' ')[0]?.slice(2);
			if (!srcName) return false;
			srcName = srcName.slice(0, srcName.length - 2);

			let imageprefix;
			let imageExt: string | Array<string> | undefined = srcName.split('.');
			imageExt = imageExt[imageExt.length - 1];

			if (!imageExt) return false;
			switch (imageExt) {
				case 'svg':
					imageprefix = 'data:image/svg+xml;';
					break;
				case 'png':
					imageprefix = 'data:image/png;';
					break;
				case 'jpg':
					imageprefix = 'data:image/jpg;';
					break;
				case 'jpeg':
					imageprefix = 'data:image/jpg;';
					break;
				default:
					break;
			}

			if (!imageprefix) return false;

			const imageBlob = fs.readFileSync(path.resolve(__dirname, './public' + srcName));
			return { data: (imageprefix + 'base64,' + imageBlob.toString('base64')), srcName };
		}

		const dom = new JSDOM(template);

		function prefetchLink(element: string) {
			const fixedElm = element.split('>')[0];
			if (!fixedElm) return false;
			if (fixedElm.split(' ').length < 2) return false;
			if (!fixedElm.includes('client:prefetch')) return false;
			const href = fixedElm.split('href')[1]?.split(' ')[0]?.slice(2).slice(0, -1);
			if (!href) return false;
			if (href === url) return false;
			if (!href.startsWith('/')) return false;
			if (template.split('<head>')[1]?.split('</head>')[0]?.includes('"' + href + '"')) return false;
			dom.window.document.head.innerHTML += '<link rel="prefetch" href="' + href + '" as="document">\n';
		}

		async function renderComponent(component: string) {
			const item = component.split(' ')[0];
			try {
				component = fs.readFileSync(
					path.resolve(basepath + '/components/' + item + '.devto'),
					'utf-8',
				);
			} catch (e) {
				component = '';
			}

			const elements = component.split('<');
			await Promise.all(elements.map(async (componentInComponent: string | undefined) => {
				if (!componentInComponent) return;
				const ogComponent = componentInComponent;
				componentInComponent = componentInComponent.split(' ')[0];
				if (componentInComponent?.includes('/') || componentInComponent?.includes('{') || !componentInComponent) return;
				componentInComponent = componentInComponent.split('>')[0];
				if (!componentInComponent) return;
				if (componentInComponent === item) {
					console.error('Cannot include a component in itself, ignoring component (rendering ' + componentInComponent + ')');
					return;
				}
				if (componentInComponent === 'img') {
					const imaegBlob = renderImageToBase64(ogComponent);
					if (imaegBlob && typeof imaegBlob !== 'string') {
						component = component.replaceAll(imaegBlob.srcName, imaegBlob.data);
					}
				}

				if (componentInComponent === 'a') {
					if (!ogComponent) return;
					prefetchLink(ogComponent);
				}

				if (isHTML(componentInComponent)) return;
				const slottedComponent = component.split('<' + componentInComponent + '>');
				let isSlotted = false;
				let slotData: string | undefined;
				if (slottedComponent.length > 1) {
					isSlotted = true;
					slottedComponent.forEach((splitComponent, i, arr) => {
						if (splitComponent.includes('</' + componentInComponent + '>')) {
							slotData = arr[i]?.split('</' + componentInComponent + '>')[0];
						}
					});
					component = component.split('<' + componentInComponent + '>' + slotData + '</' + componentInComponent + '>').join('<!--' + componentInComponent + '-->');
				}

				let componentReplacement = await renderComponent(componentInComponent);
				if (isSlotted && slotData) {
					componentReplacement = componentReplacement.replaceAll('<slot />', slotData);
				}
				let replacementComponentName = '<' + componentInComponent;
				(!isSlotted) ? replacementComponentName += ' />' : replacementComponentName = '<!--' + componentInComponent + '-->';
				component = component.replaceAll(replacementComponentName, componentReplacement);
			}));

			return component;
		}

		await Promise.all(pageData.split('<').map(async e => {
			let item = e.split(' ')[0];
			if (!item) return;
			if (item.includes('/') || item.includes('{') || item.includes('}') || !item) return;
			item = item.split('>')[0];
			if (!item) return;
			if (item === 'img') {
				const imaegBlob = renderImageToBase64(item);
				if (imaegBlob && typeof imaegBlob !== 'string') {
					pageData = pageData.replaceAll(imaegBlob.srcName, imaegBlob.data);
				}
			}

			if (item === 'a') {
				if (!item) return;
				prefetchLink(item);
			}

			if (isHTML(item)) return;
			const slottedComponent = pageData.split('<' + item + '>');
			let isSlotted = false;
			let slotData: string | undefined;
			if (slottedComponent.length > 1) {
				isSlotted = true;
				slottedComponent.forEach((splitComponent, i, arr) => {
					if (splitComponent.includes('</' + item + '>')) {
						slotData = arr[i]?.split('</' + item + '>')[0];
					}
				});
				pageData = pageData.split('<' + item + '>' + slotData + '</' + item + '>').join('<!--' + item + '-->');
			}
			let component = await renderComponent(item);

			if (isSlotted && slotData) {
				component = component.replaceAll('<slot />', slotData);
			}

			let componentName = '<' + item;
			(!isSlotted) ? componentName += ' />' : componentName = '<!--' + item + '-->';
			pageData = pageData.replaceAll(componentName, component);
		}));

		// 4. render the app HTML. This assumes entry-server.js's exported `render`
		//    function calls appropriate framework SSR APIs,
		//    e.g. ReactDOMServer.renderToString()
		const appHtml = await compileToString(pageData);

		const styles = await vite.ssrLoadModule(basepath.slice(1) + 'style.css');

		const main = await vite.ssrLoadModule(basepath.slice(1) + 'main.ts');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const appState = await main.getAppState();

		dom.window.document.head.querySelector('script[src="/src/entry-client.ts"]')?.remove();
		dom.window.document.body.querySelector('div#app')?.setAttribute('data-server-rendered', 'true');

		let appContent = eval(appHtml.fnStr);

		const { renderSSRHydrationCode } = await vite.ssrLoadModule(basepath.slice(1) + 'lib/router/SSR/ssrHydrationGenerator');
		const code = await renderSSRHydrationCode(appContent, metaObj.reduceJavascript, metaObj.serverSideSPALikeRouting);
		let serverSideScriptInjection = '';
		let script;

		appContent = code.template;

		async function inlineImports(content: string) {
			const importRegex = /(const|let) \{{0,1} {0,1}([a-zA-Z0-9_-]*) {0,1}\}{0,1} {0,1}= {0,1}await import\(('|"|`)([a-zA-Z0-9_/.-]*)('|"|`)\);{0,1}/g;

			const result = parseFromRegex(content, importRegex);
			let newScript = result.join('\n');

			await Promise.all(result.map(async (e) => {
				if (!e) return;
				if (!e.startsWith('const') && !e.startsWith('let')) return;
				if (!e.includes('{') || !e.includes('}') || !e.includes('await import(')) return;

				const functionName = e.split('{')[1]?.split('}')[0]?.trim();
				if (!functionName) return;

				let fileName = e.split('await import(')[1]?.slice(1)?.split(')')[0];
				fileName = fileName?.substring(0, fileName?.length - 1);
				if (!fileName) return false;

				const file = await vite.ssrLoadModule(fileName);
				newScript = newScript.replace(e, file[functionName].toString().replace('__vite_ssr_import_meta__.', 'import.meta.').replace('import.meta.env.SSR', 'false'));
			}));
			return newScript;
		}

		function stringToHash(string: string) {
			let hash = 0;

			if (string.length == 0) return hash;

			for (let i = 0; i < string.length; i++) {
				const char = string.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash;
			}

			return hash;
		}
		const scriptHash: number = stringToHash((appHtml.setupScript + appHtml.script + code.script));

		if (scriptCache.get(fileName) && scriptCache.get(fileName).hash == scriptHash) {
			script = scriptCache.get(fileName).script;
		} else {
			if (!!appHtml.script || !!code.script) {
				serverSideScriptInjection = (!metaObj.reduceJavascript) ? 'document.dispatchEvent(new Event(\'router:client:load\'));' : '';
				if ((code.script).includes('appState')) {
					appHtml.script = appHtml.script.replace('const { appState, initAppState } = await import("/src/main.ts");\nawait initAppState();', '');
				}

				let compiledScript = await inlineImports(`${appHtml.setupScript} window.addEventListener("load", async () => { ${appHtml.script} ${code.script} ${serverSideScriptInjection} });`);

				compiledScript = compiledScript.replace('debugMode', main.debugMode);

				const options = {
					mangle: true,
					module: true
				};
				try {
					script = (await terser.minify(compiledScript, options)).code;
				} catch (err) {
					console.log(err);
					console.log(compiledScript);
				}

				scriptCache.set(fileName, { script, hash: scriptHash });
			}
		}

		if (script) {
			dom.window.document.head.innerHTML += '<script async type="module">' + (script) + '</script>\n';
		}

		// 5. Inject the app-rendered HTML into the template.
		let style;
		const styleHash = stringToHash((styles.default + appHtml.styles));

		if (styleCache.get(fileName) && styleCache.get(fileName).hash == styleHash) {
			style = styleCache.get(fileName).style;
		} else {
			style = new Cleancss().minify((styles.default + appHtml.styles));
			styleCache.set(fileName, { style, hash: styleHash });
		}
		dom.window.document.head.innerHTML = dom.window.document.head.innerHTML + '<style type="text/css">' + style.styles + '</style>\n';

		dom.window.document.head.innerHTML = dom.window.document.head.innerHTML + appHtml.head;

		const appContainer = dom.window.document.body.querySelector('div#app');
		if (!appContainer) return;
		appContainer.innerHTML = appContent;
		const newTemplate = dom.serialize();
		if (!newTemplate) throw new Error('internal fatal error: template content not found');
		template = newTemplate;
		return {
			html: template, status
		};
	}

	app.use('*', async (req: any, res: Response, next: NextFunction) => {
		const url: string = req._parsedOriginalUrl.pathname;
		global._ctx = { cookies: req.cookies };

		try {
			const page = await renderPage(url, req);
			let fileName: Array<string> | string = url.split('/');
			if (fileName[1] === '') {
				fileName = '/index';
			} else {
				fileName = fileName.join('/').toLowerCase().trim();
			}

			if (!page) throw new Error;

			// 6. Send the rendered HTML back.
			res.status(page.status).set({ 'Content-Type': 'text/html' }).end(page.html);
			global._ctx = {};
		} catch (err: unknown) {
			// If an error is caught, let Vite fix the stack trace so it maps back to
			// your actual source code.
			if (!(err instanceof Error)) return;
			vite.ssrFixStacktrace(err);
			res.status(500).end(err.stack);
			next(err);
		}
	});

	time = ((new Date).getTime() - start);
	console.log('\n \x1b[32m\x1b[1m VITE SSR\x1b[0m\x1b[32m v' + Vite.version + '  \x1b[30mready in \x1b[1m\x1b[37m' + time + '\x1b[0m ms\n\n\x1b[32m  ???  \x1b[0m\x1b[37mLocal: \x1b[0m\x1b[36m  http://localhost:\x1b[1m3000\x1b[36m/\x1b[0m\n\x1b[32m  ???  \x1b[0mNetwork: \x1b[0m\x1b[36mhttp://' + Ip.address() + ':\x1b[1m3000\x1b[36m/\x1b[0m');
	app.listen(3000);
}

createServer();