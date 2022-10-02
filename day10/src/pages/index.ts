import { Counter } from '../components/counter';
import { TextInput } from '../components/textInput';
import { RouterLink } from '../components/routerLink';
import { HtmlInput } from '../components/htmlInput';


export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div>
            ${Counter()}
            </div>
            <br/>
            <div>
            ${TextInput()}
            </div>
            <br/>
            <div>
            ${HtmlInput()}
            </div>
            <br/>
            1 + 2 = {1 + 2}
            <br/>
            <p d-if="appState.contents.count == 0">The count is exactly 0.</p>
            <p d-else-if="appState.contents.count == 1">The count is exactly 1.</p>
            <p d-else>The count is not 0 or 1.</p>
            "string" substringed with 0, 1 = {"string".substring(0, 1)}
            <div class="flex gap-1 justify-center">
            Go to ${RouterLink('/page2', 'Page 2')}
            </div>
        </div>
    </div>
    `;
}

export const layout = 'default'