export const RouterLink = (link: string, name: string) => {
    return `
    <a href="${link}" d-click="event.preventDefault(); renderPage('${link}')">${name}</a>
    `
}