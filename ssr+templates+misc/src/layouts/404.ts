import { RouterLink } from '../components/routerLink';


export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <h1 class="text-4xl font-bold">404</h1>
        <h2 class="text-2xl font-semibold">Looks like you're lost</h3>
        <h3 class="text-xl font-semibold">${RouterLink('/', 'return home')}</h3>
    </div>
    `
}