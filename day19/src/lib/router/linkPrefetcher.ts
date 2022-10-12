export default (anchorElms: any) => {
	const prefetchedPages: Array<string> = [];

	function prefetchLink(url: string) {
		const prefetchElm = document.createElement('link');
		prefetchElm.rel = 'prefetch';
		prefetchElm.href = url;
		prefetchElm.as = 'document';

		if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD) {
			prefetchElm.onload = () => { console.log('prefetched url: ' + url); };
			prefetchElm.onerror = (err) => { console.error('cant prefetch url: ' + url, err); };
		}

		document.head.appendChild(prefetchElm);
		prefetchedPages.push(url);
	}

	if (!('IntersectionObserver' in window)) return;
	const visibleObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			const url = entry.target.getAttribute('href');
			if (!url) return;
			if (prefetchedPages.includes(url)) {
				observer.unobserve(entry.target);
				return;
			}
			if (entry.isIntersecting) {
				prefetchLink(url);
				observer.unobserve(entry.target);
			}
		});
	});

	anchorElms.forEach((e: HTMLAnchorElement) => {
		const prefetch = e.getAttribute('client:prefetch');
		let method;
		if (prefetch == null) return;
		if (prefetch) method = prefetch;
		if (e.href.includes(document.location.origin) && !e.href.includes('#') && e.href !== (document.location.href || document.location.href + '/')) {
			// page would be a valid prefetch
			if (method == 'hover') {
				const url = e.getAttribute('href');
				if (!url) return;
				e.addEventListener('pointerenter', () => prefetchLink(url), { once: true });
			} else {
				// method is empty, visible, or invalid, either way we so the default of visible
				visibleObserver.observe(e);
			}
		}
	});
};