import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const tags = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdi", "bdo", "bgsound", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dir", "div", "dl", "dt", "element", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li", "link", "listing", "main", "map", "mark", "marquee", "menu", "menuitem", "meta", "meter", "nav", "nobr", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "plaintext", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "shadow", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "xmp"]
function isHTML(tag) {
    return tags.indexOf(tag.trim().toLowerCase()) > -1;
}

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
            let template
            template = fs.readFileSync(
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
                pageData = fs.readFileSync(
                    path.resolve(__dirname, './src/layouts/404.devto'),
                    'utf-8'
                )
            }
            let test

            pageData.split('<').forEach(e => {
                let item = e.split(' ')[0]
                if (item.includes('/') || item.includes('{') || item.includes('}') || !item) return
                item = item.split('>')[0]
                if (isHTML(item)) return
                const component = fs.readFileSync(
                    path.resolve('./src/components/' + item + '.devto'),
                    'utf-8',
                )
                pageData = pageData.replace('<' + item + ' />', component)
                test = pageData
                console.log(pageData)
            })

            // 4. render the app HTML. This assumes entry-server.js's exported `render`
            //    function calls appropriate framework SSR APIs,
            //    e.g. ReactDOMServer.renderToString()
            const appHtml = await SSRPage(pageData)

            const styles = await vite.ssrLoadModule('/src/style.css')

            const main = await vite.ssrLoadModule('/src/main')

            const appState = main.appState
            // 5. Inject the app-rendered HTML into the template.
            const stylizedTemplate = template.replace('<!--style-outlet-->', '<style type="text/css">' + styles.default + '</style>')

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