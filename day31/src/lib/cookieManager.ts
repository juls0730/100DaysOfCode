export function setCookie(name: string, value: string, expires: string | Date, path?: string, domain?: string) {
	if (import.meta.env.SSR) return;
	let cookie = name.trimEnd() + '=' + escape(value) + ';';

	if (expires) {
		// If it's a date
		if (expires instanceof Date) {
			// If it isn't a valid date
			if (isNaN(expires.getTime())) expires = new Date();
		}
		else expires = new Date(new Date().getTime() + parseInt(expires) * 1000 * 60 * 60 * 24);

		cookie += 'expires=' + expires.toUTCString() + ';';
	}

	if (path) cookie += 'path=' + path + ';';
	if (domain) cookie += 'domain=' + domain + ';';

	document.cookie = cookie;
}

let ctx: any;
if (import.meta.env.SSR) {
	ctx = (await import('../entry-server')).ctx;
}

export function getCookie(name: string) {
	let decodedCookie: any;
	console.log('getting cookie', name);
	if (import.meta.env.SSR) {
		console.log('SSR COOKIES:', ctx.cookies.username);
		if (!ctx.cookies) return '';
		if (ctx.cookies[name] === undefined) return '';
		return ctx.cookies[name];
	} else {
		decodedCookie = decodeURIComponent(document.cookie);
	}
	const cname = name + '=';
	const ca = decodedCookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		if (!c) return;
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(cname) == 0) {
			return c.substring(cname.length, c.length);
		}
	}
	return '';
}