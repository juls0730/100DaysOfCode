import { Counter } from '/src/components/counter';
import { TextInput } from '/src/components/textInput';
import { MyDad } from '/src/components/myDad';
import { RouterLink } from '/src/components/routerLink';


export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
            ${Counter()}
            <br/>
            ${TextInput()}
            <br/>
            ${MyDad()}
            <br/>
            <div class="flex gap-1 justify-center">
            Go to ${RouterLink('/page2', 'Page 2')}
            </div>
        </div>
    </div>
    `
}