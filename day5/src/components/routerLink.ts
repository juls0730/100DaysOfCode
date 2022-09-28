export const RouterLink = (link: string, name: string) => {
    return `
    <a href="#" d-click="event.preventDefault(); loadPage('${link}')">${name}</a>
    `
}