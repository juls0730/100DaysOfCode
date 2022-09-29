import { Counter } from '../components/counter';
import { TextInput } from '../components/textInput';
import { MyDad } from '../components/myDad';
import { RouterLink } from '../components/routerLink';
import { CookieInput } from '../components/cookieInput';


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
            ${CookieInput()}
            <br/>
            <div class="flex gap-1 justify-center">
            Go to ${RouterLink('/page2', 'Page 2')}
            </div>
        </div>
    </div>
    `
}

export const layout = 'default'