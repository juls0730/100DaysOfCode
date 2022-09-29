import { render } from './templateRenderer'
import { appState } from '../main'
import { setCookie, getCookie } from './cookieManager'
const documentBody = document.getElementById('app')

setCookie('test', 'yee', 365)
console.log(getCookie('username'))

// Global function to handle rendering a page and navigation
export async function loadPage(route?: string) {
    let templatedVirtualDom
    if (!documentBody) {
        throw new Error('Fatal Error: element with id app not found')
    }

    if (route) history.pushState('', '', route)

    let fileName: any = window.location.pathname.split('/');
    if (fileName[1] === '') {
        fileName = '/index'
    } else {
        fileName = fileName.join('/').toLowerCase().trim()
    }

    let file
    try {
        file = await import(/* @vite-ignore */ '../pages' + fileName)
    } catch (e) {
        file = await import(/* @vite-ignore */ '../layouts/404');
    }
    const template = await file.default()

    templatedVirtualDom = await eval(render(template))
    documentBody.innerHTML = templatedVirtualDom
    // here we hydrate/re-hydrate the page content
    await hydratePage()
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
        const querySelector = "data-token-" + e.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
        const listeningElements = document.querySelectorAll(`[${querySelector}]`)
        listeningElements.forEach((elm) => {
            appState.listen(e, (change: any) => elm.textContent = change);
        })
    })
    // here we look for elements with the d-click attribute and on click run the function in the attribute
    let elms = documentBody.querySelectorAll('*[d-click]')
    elms.forEach((e) => {
        const clickFunction = e.getAttribute("d-click")
        if (!clickFunction) return;
        e.addEventListener('click', () => {
            eval(clickFunction)
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
        e.addEventListener('input', (event: any) => { 
            appState.contents[modelName] = event.target.value
        })
    })
}