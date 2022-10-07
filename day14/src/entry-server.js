import { render } from './lib/templateRenderer';
import { setSSR, appState } from './main';

export function SSRPage(pageName) {
    setSSR()
    return render(pageName)
}