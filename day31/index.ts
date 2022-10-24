import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import * as Vite from 'vite';
import cookies from 'cookie-parser';
import Cleancss from 'clean-css';
import Ip from 'ip';

const tags = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'decorator', 'del', 'details', 'devto:head', 'dfn', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'shadow', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
function isHTML(tag: string) {
	return tags.indexOf(tag.trim().toLowerCase()) > -1;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cheerio = (await import('cheerio'));
let time: number;

async function createServer() {
	const start = (new Date).getTime();
	const app = express();
	// const cache: Record<string, string> = {};
	const pages: Array<string> = [];

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

	fs.readdirSync(path.join(__dirname, basepath + 'pages/')).forEach((e: string) => {
		const pageName = e.split('.devto')[0];
		if (!pageName) return;
		pages.push(pageName);
	});


	// Create Vite server in middleware mode and configure the app type as
	// 'custom', disabling Vite's own HTML serving logic so parent server
	// can take control
	const vite = await createViteServer({
		server: { middlewareMode: true, port: 3000 },
		appType: 'custom'
	});

	// use vite's connect instance as middleware
	// if you use your own express router (express.Router()), you should use router.use
	app.use(vite.middlewares);

	async function renderPage(url: string) {
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

		if (pages.indexOf(fileName.slice(1, fileName.length)) == -1) {
			status = 404;
		}

		// 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
		//    also applies HTML transforms from Vite plugins, e.g. global preambles
		//    from @vitejs/plugin-react
		template = await vite.transformIndexHtml(url, template);

		// 3. Load the server entry. vite.ssrLoadModule automatically transforms
		//    your ESM source code to be usable in Node.js! There is no bundling
		//    required, and provides efficient invalidation similar to HMR.
		const { SSRPage } = await vite.ssrLoadModule('/src/entry-server.ts');

		let pageData: string;

		try {
			pageData = fs.readFileSync(
				path.resolve(__dirname, basepath + '/pages' + fileName + '.devto'),
				'utf8',
			);
		} catch (e) {
			pageData = fs.readFileSync(
				path.resolve(__dirname, basepath + '/layouts/404.devto'),
				'utf8'
			);
		}

		pageData.split('<').forEach(e => {
			let item = e.split(' ')[0];
			if (!item) return;
			if (item.includes('/') || item.includes('{') || item.includes('}') || !item) return;
			item = item.split('>')[0];
			if (!item) return;
			if (isHTML(item)) return;
			const component = fs.readFileSync(
				path.resolve(basepath + '/components/' + item + '.devto'),
				'utf-8',
			);
			pageData = pageData.replace('<' + item + ' />', component);
		});

		// 4. render the app HTML. This assumes entry-server.js's exported `render`
		//    function calls appropriate framework SSR APIs,
		//    e.g. ReactDOMServer.renderToString()
		const appHtml = await SSRPage(pageData);

		const styles = await vite.ssrLoadModule(basepath.slice(1) + 'style.css');

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { appState } = await vite.ssrLoadModule(basepath.slice(1) + 'main.ts');

		const $ = cheerio.load(template, null, true);
		$('html', null).children('head').children('script[src="/src/entry-client.ts"]').remove();
		$('html', null).children('body').children('div#app').prop('data-server-rendered', 'true');

		// template = template.replace('id="app"', 'id="app" data-server-rendered="true"');

		const { renderSSRHydrationCode } = await vite.ssrLoadModule(basepath.slice(1) + 'lib/router/ssrHydrationGenerator');

		let code = await renderSSRHydrationCode(eval(appHtml.fnStr));

		if (appHtml.script || code) {
			if (code) code = code + 'document.dispatchEvent(new Event(\'router:client:load\'));';
			if ((code).includes('appState')) {
				appHtml.script = appHtml.script.replace('const { appState } = await import("/src/main.ts");', '');
			}
			$('html', null).children('head').append('<script async type="module">' + (appHtml.script + code) + '</script>');
		}

		// 5. Inject the app-rendered HTML into the template.
		const style = new Cleancss().minify((styles.default + appHtml.styles));
		$('html', null).children('head').append('<style type="text/css">' + style.styles + '</style>');

		$('html', null).children('head').prepend(appHtml.head);

		$('html', null).children('body').children('div#app').append(eval(appHtml.fnStr));
		template = $.html();
		return {
			html: template, status
		};
	}

	app.use('*', async (req: Request, res: Response, next: NextFunction) => {
		const url: string = req.originalUrl;
		const { setContext } = await vite.ssrLoadModule('/src/entry-server.ts');
		setContext({ cookies: req.cookies });

		try {
			const page = await renderPage(url);
			let fileName: Array<string> | string = url.split('/');
			if (fileName[1] === '') {
				fileName = '/index';
			} else {
				fileName = fileName.join('/').toLowerCase().trim();
			}

			if (!page) throw new Error;

			// set the cache with key of fileName for example index to the pages content so it can be rendered at blazing speeds later

			// 6. Send the rendered HTML back.
			res.status(page.status).set({ 'Content-Type': 'text/html' }).end(page.html);
			setContext({});
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
	console.log('\n \x1b[32m\x1b[1m VITE SSR\x1b[0m\x1b[32m v' + Vite.version + '  \x1b[30mready in \x1b[1m\x1b[37m' + time + '\x1b[0m ms\n\n\x1b[32m  ➜  \x1b[0m\x1b[37mLocal: \x1b[0m\x1b[36m  http://localhost:\x1b[1m3000/\n\x1b[32m  ➜  \x1b[0m\x1b[1mNetwork: \x1b[0m\x1b[36mhttp://' + Ip.address() + ':\x1b[1m3000/');
	app.listen(3000);
}

createServer();