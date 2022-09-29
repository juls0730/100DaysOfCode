import { Counter } from '../components/counter';
import { TextInput } from '../components/textInput';
import { RouterLink  } from '../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
            ${Counter()}
            <br/>
            ${TextInput()}
            <br/>
            <div class="flex gap-1 justify-center">
            Go to ${RouterLink('/subroute/page', 'subroute page')}
            </div>
        </div>
    </div>
    `
}