import { RouterLink } from '../../../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <h1 class="text-2xl font-semibold">nested page</h1>
        <br/>
        <div class="grid grid-cols-1">
            This is a deeply nested page
            Go ${RouterLink('/experiences/day5', 'back')}
        </div>
    </div>
    `;
}

