import { Counter } from '../../components/counter';
import { RouterLink } from '../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 8 & 10</h1>
            <h3 class="text-lg">On day 8 & 10 I played around with conditional rendering.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        ${Counter()}
        <p d-if="appState.contents.count == 0">The count is exactly 0.</p>
        <p d-else-if="appState.contents.count == 1">The count is exactly 1.</p>
        <p d-else>The count is not 0 or 1.</p>
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export const layout = 'default'