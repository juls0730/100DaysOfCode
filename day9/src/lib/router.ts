import { compileToString } from './templateRenderer'
import { appState } from '../main'
const documentBody = document.getElementById('app')

// Global function to handle rendering a page and navigation
export async function renderPage(route?: string) {
    if (!documentBody) {
        throw new Error('Fatal Error: element with id app not found')
    }

    if (route) navigatePage(route)

    let fileName: any = window.location.pathname.split('/');
    if (fileName[1] === '') {
        fileName = '/index';
    } else {
        fileName = fileName.join('/').toLowerCase().trim();
    }

    const template = await loadPage(fileName);

    const stringifiedTemplate = await compileToString(template);

    if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD) {
        console.groupCollapsed('Loaded page ' + fileName);
        console.info('Template: ' + template)
        console.info('stringified template: ' + stringifiedTemplate)
        console.groupEnd()
    }

    documentBody.innerHTML = await eval(stringifiedTemplate);
    // here we hydrate/re-hydrate the page content
    await hydratePage()
}

async function navigatePage(route: string) {
    history.pushState('', '', route);
}

async function loadPage(page: string) {
    let file
    try {
        file = await import(/* @vite-ignore */ '../pages' + page);
    } catch (e) {
        console.log(e)
        file = await import(/* @vite-ignore */ '../layouts/404');
    }
    const template = await file.default();

    return template;
}

// function to turn the template into reactive content "hydating" a page
export async function hydratePage() {
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
            if (elm.parentElement?.getAttribute('d-once') !== null) return;
            if (elm.parentElement?.getAttribute('d-html') !== null) { 
                appState.listen(e, (change: any) => elm.innerHTML = change);
            } else {
                appState.listen(e, (change: any) => elm.textContent = change);
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

    // here we determine if an element should be deleted form the DOM via the d-if directive
    let conditionalElms = document.querySelectorAll('*[d-if]')
    conditionalElms.forEach(async (e) => {
        const condition = e.getAttribute('d-if')
        e.removeAttribute('d-if')
        const originalHTML = e.innerHTML
        if (!condition) return;
        if (condition.includes("appState.contents.")) {
            let reactiveProp: any = /appState\.contents\.[a-zA-Z]+/.exec(condition)
            if (!reactiveProp) return;
            reactiveProp = reactiveProp[0].split('.')[2]
            appState.listen(reactiveProp, () => {
                if (!!eval(condition)) {
                    e.innerHTML = originalHTML
                } else {
                    e.innerHTML = `<!-- d-if -->`
                }
            })
        }
        if (!eval(condition)) {
            // the condition is false​
            e.innerHTML = `<!-- d-if -->`
        }
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
        e.addEventListener('input', (event: any) => {
            appState.contents[modelName] = event.target.value
        })
    })
}