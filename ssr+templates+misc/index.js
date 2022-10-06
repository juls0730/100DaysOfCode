import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createServer() {
    const app = express()

    app.use(express.static(__dirname + '/public'))

    // Create Vite server in middleware mode and configure the app type as
    // 'custom', disabling Vite's own HTML serving logic so parent server
    // can take control
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom'
    })

    // use vite's connect instance as middleware
    // if you use your own express router (express.Router()), you should use router.use
    app.use(vite.middlewares)

    app.use('*', async (req, res, next) => {
        const url = req.originalUrl

        try {
            // 1. Read index.html
            let template = fs.readFileSync(
                path.resolve(__dirname, 'index.html'),
                'utf-8'
            )

            let fileName = url.split('/');
            if (fileName[1] === '') {
                fileName = '/index';
            } else {
                fileName = fileName.join('/').toLowerCase().trim();
            }

            console.log(fileName);

            // 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
            //    also applies HTML transforms from Vite plugins, e.g. global preambles
            //    from @vitejs/plugin-react
            template = await vite.transformIndexHtml(url, template)

            // 3. Load the server entry. vite.ssrLoadModule automatically transforms
            //    your ESM source code to be usable in Node.js! There is no bundling
            //    required, and provides efficient invalidation similar to HMR.
            const { SSRPage } = await vite.ssrLoadModule('/src/entry-server.js')

            let pageData
            try {
                pageData = fs.readFileSync(
                    path.resolve(__dirname, './src/pages' + fileName + '.devto'),
                    'utf-8',
                )
            } catch (e) {
                throw new Error(e)
            }

            console.log(pageData)

            // 4. render the app HTML. This assumes entry-server.js's exported `render`
            //    function calls appropriate framework SSR APIs,
            //    e.g. ReactDOMServer.renderToString()
            const appHtml = await SSRPage(pageData)

            console.log(appHtml)

            const styles = fs.readFileSync(
                path.resolve(__dirname, './src/style.css'), 'utf8'
            )

            // 5. Inject the app-rendered HTML into the template.
            const stylizedTemplate = template.replace('<!--style-outlet-->', '<style>' + styles + '</style>')

            const html = stylizedTemplate.replace(`<!--ssr-outlet-->`, eval(appHtml))

            // 6. Send the rendered HTML back.
            res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
        } catch (e) {
            // If an error is caught, let Vite fix the stack trace so it maps back to
            // your actual source code.
            vite.ssrFixStacktrace(e)
            res.status(500).end(e.stack)
            next(e)
        }
    })

    app.listen(3000)
}

createServer()