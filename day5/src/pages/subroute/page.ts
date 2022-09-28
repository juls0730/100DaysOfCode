import { Counter } from '/src/components/counter';
import { RouterLink  } from '/src/components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
            ${Counter()}
            <div class="flex gap-1 justify-center">
            go ${RouterLink('/subroute/deep/deeper/deepest', 'deeper')}
            </div>
        </div>
    </div>
    `
}