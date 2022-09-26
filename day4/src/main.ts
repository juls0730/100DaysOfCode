import './style.css';
import { Reactive } from './lib/ReactiveObject'
import { compileToString } from './lib/templateRenderer'
import { Counter } from './components/counter';
import { TextInput } from './components/textInput';

const virtualDomBody = `
<div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 max-h-3/6 border-neutral-800 rounded-lg container__count border">
            ${Counter()}
            <br/>
            ${TextInput()}
        </div>
    </div>
`


const appState = new Reactive({
    count: 0,
    text: ''
});
// run code to compile the templated virtualDomBody into a play body
const templatedVirtualDom = eval(compileToString(virtualDomBody))

// equivalent to mounted() on svelte or vue
window.addEventListener('load', () => {
    const documentBody = document.getElementById('app')
    if (!documentBody) {
        throw new Error
    }
    documentBody.innerHTML = templatedVirtualDom
    Object.keys(appState.contents).forEach((e) => {
        if (e === undefined) return
        console.log(e)
        const querySelector = "data-token-" + e.split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
        const listeningElements = document.querySelectorAll(`[${querySelector}]`)
        listeningElements.forEach((elm) => {
            appState.listen(e, (change) => elm.textContent = change);
        })
    })
    let elms = documentBody.querySelectorAll('*[d-click]')
    elms.forEach((e) => {
        const clickFunction = e.getAttribute("d-click")
        if (!clickFunction) return;
        e.addEventListener('click', () => {
            eval(clickFunction)
        })
    })

    let modelElms = document.querySelectorAll('*[d-model]')
    modelElms.forEach((e) => {
        const modelName = e.getAttribute("d-model")
        if (!modelName) return;
        e.addEventListener('input', (event: any) => {
            appState.contents[modelName] = event.target.value
        })
    })
})