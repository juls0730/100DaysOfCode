import { RouterLink } from '../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 12</h1>
            <h3 class="text-lg">On day 12 I worked with pointer events.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        <div id="test"></div>
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export function mounted() {
    return `
    console.log('mounted')
    document.getElementById('test').innerHTML = '<p>Hello world!</p>'
    `
}

export const layout = 'default'