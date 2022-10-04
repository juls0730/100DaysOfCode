import { RouterLink } from '../../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <h1 class="text-2xl font-semibold">Page 2</h1>
        <br/>
        <div class="grid grid-cols-1">
            This is page 2
            Go ${RouterLink('/experiences/day5', 'back')}
        </div>
    </div>
    `;
}

