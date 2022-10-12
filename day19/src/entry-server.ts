import { render } from './lib/templateRenderer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { appState } from './main';

export function SSRPage(pageName: string) {
	return render(pageName);
}