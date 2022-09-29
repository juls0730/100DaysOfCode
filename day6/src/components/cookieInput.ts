export const CookieInput = () => {
    return `
    <div class="mb-2">
    <h2 class="text-xl font-semibold text-center">Username cookie is: {cookie}</h2>
</div>
<div class="flex justify-center flex-col">
    <input placeholder="username..." class="py-2 px-4 resize-none bg-zinc-800 rounded-md shadow-md my-2 border border-zinc-800 placeholder:italic placeholder:text-gray-300" d-model="cookiedata" />
    {cookiedata}
    <button class="bg-blue-600 font-semibold rounded-md py-1 px-2 text-sm" d-click="appState.contents.cookie = appState.contents.cookiedata; setCookie('username', appState.contents.cookiedata, '365');">Submit Cookie</button>
</div>
    `
}