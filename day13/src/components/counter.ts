import minus from '../icons/minus.svg'
import plus from '../icons/plus.svg'
import refresh from '../icons/refresh.svg'

export const Counter = () => {
    return `
    <div class="mb-2">
                <h2 class="text-xl font-semibold text-center">count is: { appState.contents.count }</h2>
            </div>
    <div class="flex justify-center">
    <button d-on:click="appState.contents.count--" class="transition-colors p-3 duration-300 active:bg-red-700 hover:bg-red-600 hover:text-zinc-100 mr-1">
    <img src=${minus} alt="minus" />
    </button>
    <button d-on:click="appState.contents.count = 0" class="transition-colors p-3 duration-300 active:bg-zinc-700 hover:bg-zinc-800 hover:text-red-100 mr-1">
        <img src=${refresh} alt="reset">
    </button>
    <button d-on:click="appState.contents.count++" class="transition-colors p-3 duration-300 active:bg-green-700 hover:bg-green-600 hover:text-green-100">
        <img src=${plus} alt="plus" />
    </button>
</div>
    `
}
