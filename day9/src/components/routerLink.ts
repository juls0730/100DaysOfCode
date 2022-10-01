export const RouterLink = (link: string, name: string) => {
    return `
    <a href="${link}" d-on:click="event.preventDefault(); renderPage('${link}')">${name}</a>
    `
}