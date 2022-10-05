import { RouterLink } from '../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 11</h1>
            <h3 class="text-lg">On day 11 I worked with pointer events.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        <div id="ad" class="p-6 rounded-md bg-gray-600 transition-colors" d-on:pointerEnter="document.getElementById('ad').classList.toggle('!bg-gray-700')" d-on:pointerExit="document.getElementById('ad').classList.toggle('!bg-gray-700')" d-on:mouseDown="document.getElementById('ad').classList.toggle('!bg-gray-800')" d-on:mouseUp="document.getElementById('ad').classList.toggle('!bg-gray-800')">asd</div>
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export const layout = 'default'