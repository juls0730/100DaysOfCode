import { compileToString } from './templateRenderer'
import { isSSR } from '../entry-client'
import { appState } from '../main'
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
        console.info('stringified template: ' + stringifiedTemplate)
        console.groupEnd()
    }

    documentBody.innerHTML = await eval(stringifiedTemplate);
    // here we hydrate/re-hydrate the page content
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

    await fetch('/src/pages' + url + '.devto').then((response) => {
        if (response.ok) {
            return response.text();
        }
        throw new Error('Something went wrong');
    })
        .then((data) => {
            file = data
        })
        .catch(async (error) => {
            await fetch('/src/layouts/404.devto').then((response) => {
                if (response.ok) {
                    return response.text();
                }
                throw new Error('Something went wrong');
            })
                .then((data) => {
                    file = data
                })
        });

    let elements = file.split('<')
    let template = file

    await Promise.all(elements.map(async (component) => {
        component = component.split(' ')[0]
        if (component.includes('/') || component.includes('{') || !component) return
        component = component.split('>')[0]
        if (isHTML(component)) return
        await fetch('/src/components/' + component + '.devto').then((response) => {
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

// function to turn the template into reactive content "hydating" a page
export async function hydratePage() {
    if (import.meta.env.SSR) return
    if (!documentBody) {
        throw new Error('Fatal Error: element with id app not found')
    }

    // for every item in the appState lets check for any element with the "checksum", a hex code equivalent of the item name
    Object.keys(appState.contents).forEach((e) => {
        if (e === undefined) return
        // here we check for elements with the name of "data-token-<hex code of the item name>"
        const uuid = e.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
        const listeningElements = document.querySelectorAll(`[${"data-token-" + uuid}]`)
        listeningElements.forEach((elm) => {
            if (elm.parentElement?.getAttribute('d-once') !== null) {
                elm.parentElement?.removeAttribute('d-once');
                return;
            }

            if (elm.parentElement?.getAttribute('d-html') !== null) {
                appState.listen(e, (change) => elm.innerHTML = change);
                elm.parentElement?.removeAttribute('d-html')
            } else {
                appState.listen(e, (change) => elm.textContent = change);
            }
        })
    })

    // here we look for elements with the d-on:click attribute and on click run the function in the attribute
    let elms = documentBody.querySelectorAll('*[d-on\\3A click]')
    elms.forEach((e) => {
        const clickFunction = e.getAttribute("d-on\:click")
        e.removeAttribute('d-on\:click')
        if (!clickFunction) return;
        e.addEventListener('click', () => {
            eval(clickFunction)
        })
    })

    document.body.addEventListener('keydown', (e) => {
        ctrlPressed = e.ctrlKey
      })

      document.body.addEventListener('keyup', (e) => {
        ctrlPressed = e.ctrlKey
      })

    // here we determine if an element should be deleted form the DOM via the d-if directive
    let conditionalElms = document.querySelectorAll('*[d-if]')
    conditionalElms.forEach(async (e) => {
        const condition = e.getAttribute('d-if')

        let siblingConditionalElms = []
        // recursively check for subsequent elements with the d-else of d-else-if attribute
        function checkForConditionSibling(elm) {
            if (elm.nextElementSibling?.getAttribute('d-else-if') !== null) {
                siblingConditionalElms.push(elm.nextElementSibling)
                checkForConditionSibling(elm.nextElementSibling)
            }

            if (elm.nextElementSibling?.getAttribute('d-else') !== null) {
                siblingConditionalElms.push(elm.nextElementSibling)
            }
        }
        checkForConditionSibling(e)

        function resetHTML() {
            e.innerHTML = '<!-- d-if -->'
            for (let i = 0; i < siblingConditionalElms.length; i++) {
                siblingConditionalElms[i].innerHTML = '<!-- d-if -->'
            }
        }

        let ifStatement = `if (!!eval(condition)) {
            e.innerHTML = originalHTML
        } `

        for (let i = 0; i < siblingConditionalElms.length; i++) {
            const originHTML = siblingConditionalElms[i].innerHTML
            siblingConditionalElms[i].innerHTML = '<!-- d-if -->'
            let statementDirective = 'else'
            if (siblingConditionalElms[i].getAttribute('d-else-if') !== null) {
                statementDirective = 'else if'
            }
            const condition = eval(`siblingConditionalElms[i].getAttribute('d-' + statementDirective.split(' ').join('-'))`)

            if (statementDirective == 'else if') {
                statementDirective = 'else if (' + condition + ')'
            }

            ifStatement = ifStatement + statementDirective + `{
                siblingConditionalElms[${i}].innerHTML = "${originHTML}"
            }`
        }

        e.removeAttribute('d-if')
        const originalHTML = e.innerHTML
        if (!condition) return;
        if (condition.includes("appState.contents.")) {
            let reactiveProp = /appState\.contents\.[a-zA-Z]+/.exec(condition)
            if (!reactiveProp) return;
            reactiveProp = reactiveProp[0].split('.')[2]
            appState.listen(reactiveProp, () => {
                resetHTML()
                eval(ifStatement)
            })
        }


        eval(ifStatement)
    })

    let pointerEnterElms = document.querySelectorAll('*[d-on\\3A pointerEnter]')
    pointerEnterElms.forEach((e) => {
        const enterFunction = e.getAttribute('d-on\:pointerEnter')
        e.removeAttribute('d-on\:pointerEnter')
        if (!enterFunction) return;
        e.addEventListener('pointerenter', (event) => {
            eval(enterFunction)
        })
    })

    let pointerExitElms = document.querySelectorAll('*[d-on\\3A pointerExit]')
    pointerExitElms.forEach((e) => {
        const exitFunction = e.getAttribute('d-on\:pointerExit')
        e.removeAttribute('d-on\:pointerExit')
        if (!exitFunction) return;
        e.addEventListener('pointerleave', (event) => {
            eval(exitFunction)
        })
    })

    let mouseDownElms = document.querySelectorAll('*[d-on\\3A mouseDown]')
    mouseDownElms.forEach((e) => {
        const downFunction = e.getAttribute('d-on\:mouseDown')
        e.removeAttribute('d-on\:mouseDown')
        if (!downFunction) return;
        e.addEventListener('mousedown', (event) => {
            eval(downFunction)
        })
    })

    let mouseUpElms = document.querySelectorAll('*[d-on\\3A mouseUp]')
    mouseUpElms.forEach((e) => {
        const dupFunction = e.getAttribute('d-on\:mouseUp')
        e.removeAttribute('d-on\:mouseUp')
        if (!dupFunction) return;
        e.addEventListener('mouseup', (event) => {
            eval(dupFunction)
        })
    })

    // here we look for elements with the d-model attribute and if there is any input in the element then we update the appState item with the name
    // of the attribute value
    // example: if the user types "hello" into a text field with the d-model attribute of "text" then we update the appState item with the name "text"
    //          to "hello"
    // similar to vue.js v-model attribute
    let modelElms = document.querySelectorAll('input[d-model], textarea[d-model]');
    modelElms.forEach((e) => {
        const modelName = e.getAttribute("d-model")
        if (!modelName) return;
        e.addEventListener('input', (event) => {
            appState.contents[modelName] = event.target.value
        })
    })

    let anchorElms = document.querySelectorAll('a');
    anchorElms.forEach((e) => {
        e.addEventListener('click', (click) => {
            event.preventDefault()
            renderPage(click.target.getAttribute('href'));
        })
    })

    // if SSR is enabled then we should prefetch pages so that they will render instantly when navigated to
    if (isSSR()) {
        let prefetchedPages = []

        function prefetchLink(url) {
            const prefetchElm = document.createElement('link')
            prefetchElm.rel = 'prefetch'
            prefetchElm.href = url
            prefetchElm.as = 'document'

            if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD) {
                prefetchElm.onload = () => { console.log('prefetched url: ' + url) }
                prefetchElm.onerror = (err) => { console.error('cant prefetch url: ' + url, err) }
            }

            document.head.appendChild(prefetchElm)
            prefetchedPages.push(url)
        }

        if (!('IntersectionObserver' in window)) return
        const visibleObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                const url = entry.target.getAttribute('href')
                if (prefetchedPages.includes(url)) {
                    observer.unobserve(entry.target);
                    return
                }
                if (entry.isIntersecting) {
                    prefetchLink(url)
                    observer.unobserve(entry.target)
                }
            });
        })

        anchorElms.forEach((e) => {
            const prefetch = e.getAttribute('client\:prefetch');
            let method
            if (prefetch == null) return
            if (!!prefetch) method = prefetch
            if (e.href.includes(document.location.origin) && !e.href.includes('#') && !e.href !== (document.location.href || document.location.href + '/')) {
                // page would be a valid prefetch
                if (method == 'hover') {
                    const url = e.getAttribute('href')
                    e.addEventListener('pointerenter', () => prefetchLink(url), { once: true })
                } else {
                    // method is empty, visible, or invalid, either way we so the default of visible
                    visibleObserver.observe(e)
                }
            }
        })
    }
}