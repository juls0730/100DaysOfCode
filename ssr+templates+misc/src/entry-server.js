import { render } from './lib/templateRenderer';
import { setSSR } from './main';

export function SSRPage(pageName) {
    setSSR()
    return render(pageName)
}