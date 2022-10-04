import { RouterLink } from '../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 7</h1>
            <h3 class="text-lg">On day 7 I got plain javascript running in my templates.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        <p>1 + 2 = {1+2}</p>
        <p>"string" substringed with 0, 1 = {"string".substring(0, 1)}</p>
        <p>Current url is {window.location}</p>
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export const layout = 'default'