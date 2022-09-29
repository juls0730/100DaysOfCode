import { RouterLink } from '../components/routerLink';


export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <h1 class="text-4xl font-semibold">Looks like you're lost</h1>
        <h3 class="text-xl font-semibold">${RouterLink('/', 'return home')}</h3>
    </div>
    `
}