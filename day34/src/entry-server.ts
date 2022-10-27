import { compileToString } from './lib/templateRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState, initAppState } from './main';
export let ctx = {};

export async function SSRPage(template: string) {
	await initAppState();
	return compileToString(template);
}

export function setContext(context: Record<string, unknown>) {
	ctx = context;
}

export function getContext() {
	return ctx;
}