export const MyDad = () => {
    return `
    <div class="mb-2">
    <h2 class="text-xl font-semibold text-center">My dad {year}</h2>
</div>
<div class="flex justify-center">
<input placeholder="ex: 1985" class="no-arrows py-2 px-4 resize-none bg-zinc-800 rounded-md shadow-md my-2 border border-zinc-800 placeholder:italic placeholder:text-gray-300" type="number" d-model="year">
</div>
<style>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}
</style>
    `
}