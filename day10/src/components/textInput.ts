export const TextInput = () => {
    return `
    <div class="mb-2">
    <h2 class="text-xl font-semibold text-center">Input is: {appState.contents.text}</h2>
</div>
<div class="flex justify-center">
<div>
    <input placeholder="text..." class="py-2 px-4 resize-none bg-zinc-800 rounded-md shadow-md my-2 border border-zinc-800 placeholder:italic placeholder:text-gray-300" d-model="text" />
    </div>
    </div>
    `
}