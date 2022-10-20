import { compileToString } from './lib/templateRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState } from './main';

export function SSRPage(template: string) {
	return compileToString(template);
}