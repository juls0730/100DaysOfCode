import { render } from './lib/templateRenderer';
import { appState } from './main';

export function SSRPage(pageName) {
    return render(pageName)
}