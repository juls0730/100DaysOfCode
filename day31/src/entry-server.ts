import { compileToString } from './lib/templateRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState } from './main';
export let ctx = {};

export function SSRPage(template: string) {
	return compileToString(template);
}

export function setContext(context: Record<string, unknown>) {
	ctx = context;
}

export function getContext() {
	return ctx;
}