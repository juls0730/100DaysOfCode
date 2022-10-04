import { RouterLink } from '../../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <div class="min-w-full text-center">
            <h1 class="text-2xl font-semibold">Day 5</h1>
            <h3 class="text-lg">On day 5 I learnt about SPA routing.</h3>
        </div>
        <br/>
        <div class="p-2 border border-neutral-800 rounded-md shadow-md">
        Go ${RouterLink('/experiences/routes/page2', 'Deeper')}
        Go ${RouterLink('/experiences/routes/deeper/deep', 'So deep')}
        </div>
        <br/>
        <div class="text-center">
            Return ${RouterLink('/', 'Home')}
        </div>
    </div>
    `;
}

export const layout = 'default'