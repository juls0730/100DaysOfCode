import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tags = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'decorator', 'del', 'details', 'dfn', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'shadow', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
function isHTML(tag: string) {
	return tags.indexOf(tag.trim().toLowerCase()) > -1;
}

async function createServer() {
	const app = express();

	app.use(express.static(__dirname + '/public'));
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,cache-control');
		res.setHeader('Cache-Control', 'max-age=43200, public');

		next();
	});

	app.use(compression({ filter: shouldCompress }));

	function shouldCompress(req: Request, res: Response) {
		if (req.headers['x-no-compression']) {
			// don't compress responses with this request header
			return false;
		}

		// fallback to standard filter function
		return compression.filter(req, res);
	}


	// Create Vite server in middleware mode and configure the app type as
	// 'custom', disabling Vite's own HTML serving logic so parent server
	// can take control
	const vite = await createViteServer({
		server: { middlewareMode: true },
		appType: 'custom'
	});

	// use vite's connect instance as middleware
	// if you use your own express router (express.Router()), you should use router.use
	app.use(vite.middlewares);

	app.use('*', async (req: Request, res: Response, next: NextFunction) => {
		const url: string = req.originalUrl;

		try {
			// 1. Read index.html
			let template: string;
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

			template = template.replace('<script async src="/src/entry-client.ts" type="module"></script>', '');

			// 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
			//    also applies HTML transforms from Vite plugins, e.g. global preambles
			//    from @vitejs/plugin-react
			template = await vite.transformIndexHtml(url, template);

			// 3. Load the server entry. vite.ssrLoadModule automatically transforms
			//    your ESM source code to be usable in Node.js! There is no bundling
			//    required, and provides efficient invalidation similar to HMR.
			const { SSRPage } = await vite.ssrLoadModule('/src/entry-server.ts');

			let pageData: string;
			let basepath: string;

			(process.env.NODE_ENV == 'production') ? basepath = './' : basepath = './src/';
			try {
				pageData = fs.readFileSync(
					path.resolve(__dirname, basepath + '/pages' + fileName + '.devto'),
					'utf-8',
				);
			} catch (e) {
				pageData = fs.readFileSync(
					path.resolve(__dirname, basepath + '/layouts/404.devto'),
					'utf-8'
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

			const main = await vite.ssrLoadModule(basepath.slice(1) + 'main');

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const appState = main.appState;

			template = template.replace('id="app"', 'id="app" data-server-rendered="true"');

			let scriptedTemplate = template;

			const { renderSSRHydrationCode } = await vite.ssrLoadModule(basepath.slice(1) + 'lib/router/ssrHydrationGenerator');

			const code = await renderSSRHydrationCode(eval(appHtml.fnStr));

			if (appHtml.script || code) {
				scriptedTemplate = template.replace('<!--script-outlet-->', '<script async type="module">' + appHtml.script + code + '</script>');
			}

			// 5. Inject the app-rendered HTML into the template.
			const stylizedTemplate = scriptedTemplate.replace('<!--style-outlet-->', '<style type="text/css">' + styles.default + appHtml.styles + '</style>');

			const html = stylizedTemplate.replace('<!--ssr-outlet-->', eval(appHtml.fnStr));

			// 6. Send the rendered HTML back.
			res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
		} catch (err: unknown) {
			// If an error is caught, let Vite fix the stack trace so it maps back to
			// your actual source code.
			if (!(err instanceof Error)) return;
			vite.ssrFixStacktrace(err);
			res.status(500).end(err.stack);
			next(err);
		}
	});

	app.listen(3000);
}

createServer();