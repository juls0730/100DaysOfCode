export function setCookie(name: string, value: string, expires: any, path?: string, domain?: string) {
	if (import.meta.env.SSR) return;
	let cookie = name.trimEnd() + '=' + escape(value) + ';';
  
	if (expires) {
		// If it's a date
		if(expires instanceof Date) {
			// If it isn't a valid date
			if (isNaN(expires.getTime())) expires = new Date();
		}
		else expires = new Date(new Date().getTime() + parseInt(expires) * 1000 * 60 * 60 * 24);
  
		cookie += 'expires=' + expires.toGMTString() + ';';
	}
  
	if (path) cookie += 'path=' + path + ';';
	if (domain) cookie += 'domain=' + domain + ';';
  
	document.cookie = cookie;
}

export function getCookie(name: string) {
	if (import.meta.env.SSR) return;
	const cname = name + '=';
	const decodedCookie = decodeURIComponent(document.cookie);
	const ca = decodedCookie.split(';');
	for(let i = 0; i <ca.length; i++) {
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