export const compileToString = async (template: string) => {
    const ast = parse(template);
    let fnStr = `\`\``;

    ast.map(async t => {
        // checking to see if it is an interpolation
        if (t.startsWith("{") && t.endsWith("}")) {
            // TODO: rewrite comment
            const bracketVariable = t.split(/{|}/).filter(Boolean)[0].trim();
            if (bracketVariable.startsWith("appState.contents.")) {
                const uuid = bracketVariable.substring(bracketVariable.length, 18).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
                fnStr = fnStr.substring(0, fnStr.length - 1) + `<span data-token-${uuid}>\``;
            } else {
                fnStr = fnStr.substring(0, fnStr.length - 1) + `<span>\``;
            }
            fnStr += `+ (${bracketVariable})` + `+\`</span>\``;

        } else {
            // append the string to the fnStr
            fnStr += `+\`${t}\``;
        }
    });

    if (import.meta.env.VITE_VERBOSE) {
        console.groupCollapsed('Compiled tempalte to String')
        console.log('INFO: ' + fnStr)
        console.groupEnd()
    }

    return fnStr;
}

// this function will turn a string like "hi {user}" into an array that looks something like "["hi", "{user}"] so we can loop over the array elements
// when compiling the template
var parse = (template: string) => {
    let result = /{(.*?)}/g.exec(template);
    const arr = [];
    let firstPos;

    while (result) {
        firstPos = result.index;
        if (firstPos !== 0) {
            arr.push(template.substring(0, firstPos));
            template = template.slice(firstPos);
        }

        arr.push(result[0]);
        template = template.slice(result[0].length);
        result = /{(.*?)}/g.exec(template);
    }

    if (template) arr.push(template);
    return arr;
}

export const render = (template: string) => {
    return compileToString(template)
}