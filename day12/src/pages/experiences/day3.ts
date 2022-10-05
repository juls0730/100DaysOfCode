import { RouterLink } from '../../components/routerLink';
import { TextInput } from '../../components/textInput';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 3</h1>
            <h3 class="text-lg">On day 3 I added a d-model attribute.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        ${TextInput()}
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export const layout = 'default'