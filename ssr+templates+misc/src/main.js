let SSR = false;

export function isSSR() {
    return SSR;
}

export function setSSR() {
    SSR = true;
}