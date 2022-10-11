import { compileToString } from '../templateRenderer'
import { isSSR } from '../../entry-client'
import { appState } from '../../main'
const tags = ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdi", "bdo", "bgsound", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dir", "div", "dl", "dt", "element", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li", "link", "listing", "main", "map", "mark", "marquee", "menu", "menuitem", "meta", "meter", "nav", "nobr", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "plaintext", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "shadow", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "xmp"]
let enabled = true;
let ctrlPressed = false;

function isHTML(tag) {
    return tags.indexOf(tag.trim().toLowerCase()) > -1;
}

let documentBody

if (import.meta.env.SSR) {
    const fs = await import('fs')
    const path = await import('path')
    documentBody = fs.readFileSync(
        path.resolve('index.html'),
        'utf-8'
    )
} else {
    documentBody = document.getElementById('app')
}


// Global function to handle rendering a page and navigation
export async function renderPage(route) {
    if (ctrlPressed && route) {
        window.open(route, '__blank')
        return
    }
    if (isSSR() && route) {
        window.location.href = route
        return
    }
    if (isSSR()) return;

    // Gotta remove all the style and script tags from this page so they dont leak into other pages
    let decimateMode = false
    document.head.childNodes.forEach((e, i, arr) => {
        if (!arr[i - 2]) return
        if (decimateMode) {
            document.head.removeChild(e)
        }
        if (arr[i - 2].nodeName == '#comment' && arr[i - 2].textContent == `style-outlet`) {
            decimateMode = true
        }
    })


    if (!window.history) {
        enabled = false;
        return;
    }

    if (!documentBody) {
        throw new Error('Fatal Error: element with id app not found')
    }

    if (route) history.pushState('', '', route);

    let fileName = window.location.pathname.split('/');
    if (fileName[1] === '') {
        fileName = '/index';
    } else {
        fileName = fileName.join('/').toLowerCase().trim();
    }

    const page = await loadPage(fileName);

    // tell the web page that the router has loaded a new page, SSR is unaffected
    document.dispatchEvent(new CustomEvent('router:load', {
        detail: {
            page: fileName,
            url: window.location.pathname,
            tempalte: page,
            timeStamp: new Date().getTime()
        }
    }))

    const stringifiedTemplate = await compileToString(page);

    if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD && !import.meta.env.SSR) {
        console.groupCollapsed('Loaded page ' + fileName);
        console.info('Template: ' + page)
        console.info('stringified template: ' + stringifiedTemplate.fnStr)
        console.groupEnd()
    }

    documentBody.innerHTML = await eval(stringifiedTemplate.fnStr);
    if (stringifiedTemplate.styles) {
        const cssElement = document.createElement('style')
        cssElement.type = 'text/css'
        cssElement.innerHTML = stringifiedTemplate.styles
        document.head.appendChild(cssElement)
    }

    if (stringifiedTemplate.script) {
        const scriptElement = document.createElement('script')
        scriptElement.type = 'text/javascript'
        scriptElement.innerHTML = stringifiedTemplate.script
        document.head.appendChild(scriptElement)
    }
    // here we hydrate/re-hydrate the page content
    const { hydratePage} = await import('./hydrationManager')
    await hydratePage()
}

async function loadPage(page) {
    if (import.meta.env.SSR) return;
    if (isSSR()) return;
    const file = await fetchPage(page)

    return file;
}

async function fetchPage(url) {
    let file
    let path

    (import.meta.env.PROD) ? path = '/' : path = '/src/'

    await fetch(path + `pages${url}.devto`).then((response) => {
        if (response.ok) {
            return response.text();
        }
        throw new Error('Something went wrong');
    })
        .then((data) => {
            file = data
        })
        .catch(async (error) => {
            await fetch(path + 'layouts/404.devto').then((response) => {
                if (response.ok) {
                    return response.text();
                }
                throw new Error('Something went wrong');
            })
                .then((data) => {
                    file = data
                })
        });

    let template = file
    let elements = file.split('<')

    await Promise.all(elements.map(async (component) => {
        component = component.split(' ')[0]
        if (component.includes('/') || component.includes('{') || !component) return
        component = component.split('>')[0]
        if (isHTML(component)) return
        await fetch(path + `components/${component}.devto`).then((response) => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Something went wrong');
        })
            .then((data) => {
                file = data
            })
        template = template.replace('<' + component + ' />', file)
    })
    )

    return template
}