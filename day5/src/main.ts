import { Reactive } from './lib/ReactiveObject'
import { compileToString } from './lib/templateRenderer'
import '/src/style.css';

const documentBody = document.getElementById('app')
const appState = new Reactive({
    count: 0,
    text: '',
    year: ''
});

// Global function to handle rendering a page and navigation
async function loadPage(route?: string) {
    let templatedVirtualDom
    let fileName: any = window.location.pathname.split('/');
    if (!documentBody) {
        throw new Error
    }
    if (fileName[1] === '') {
        fileName = '/index'
    } else {
        fileName = fileName.join('/').toLowerCase().trim()
    }
    if (route) {
        // we assume the user is navigating to another page so we change the windows path to the give route
        // then we dynamically import the page from the pages directory and then we change the templatedVirtualDom
        // to the new files content
        history.pushState('', '', route)
        fileName = window.location.pathname.split('/');
        if (fileName[1] === '') { 
            fileName = '/index' 
        } else {
            fileName = fileName.join('/').toLowerCase().trim()
        }
        const file = await import(/* @vite-ignore */ './pages' + fileName)
        templatedVirtualDom = await eval(compileToString(eval(file.default)()));
    } else {
        const file = await import(/* @vite-ignore */ './pages' + fileName)
        templatedVirtualDom = await eval(compileToString(eval(file.default)()))
    }
    console.log
    documentBody.innerHTML = templatedVirtualDom
    // here we hydrate/re-hydrate the page content
    await hydratePage()
}

// function to turn the template into reactive content "hydating" a page
async function hydratePage() {
    if (!documentBody) {
        throw new Error
    }
    // for every item in the appState lets check for any element with the "checksum", a hex code equivalent of the item name
    Object.keys(appState.contents).forEach((e) => {
        if (e === undefined) return
        // here we check for elements with the name of "data-token-<hex code of the item name>"
        const querySelector = "data-token-" + e.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
        const listeningElements = document.querySelectorAll(`[${querySelector}]`)
        listeningElements.forEach((elm) => {
            appState.listen(e, (change) => elm.textContent = change);
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
    let modelElms = document.querySelectorAll('*[d-model]')
    modelElms.forEach((e) => {
        const modelName = e.getAttribute("d-model")
        if (!modelName) return;
        e.addEventListener('input', (event: any) => {
            appState.contents[modelName] = event.target.value
        })
    })
}

// equivalent to mounted() on svelte or vue
window.addEventListener('load', async () => {
    // loadPage after all the index is loaded
    await loadPage()
    window.onpopstate = async () => {
        await loadPage()
    }
})