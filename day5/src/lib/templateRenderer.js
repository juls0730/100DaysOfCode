export const compileToString = (template) => {
    const ast = parse(template);
    let fnStr = `\`\``;

    ast.map(t => {
        // checking to see if it is an interpolation
        if (t.startsWith("{") && t.endsWith("}")) {
            // so first we calculate the hex value of the variable, which is needed so we can use reactivity properly
            // then after that we append a span element with the data-token-<hex value> attribute to the span
            // finally we add the appState.contents.variables to the string so we have the value of the variable in the raw html.
            const uuid = t.split(/{|}/).filter(Boolean)[0].trim().split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
            fnStr = fnStr.substring(0, fnStr.length - 1) + `<span data-token-${uuid}>\``;
            fnStr += `+appState.contents.${t.split(/{|}/).filter(Boolean)[0].trim()}` + `+\`</span>\``;
        } else {
            // append the string to the fnStr
            fnStr += `+\`${t}\``;
        }
    });

    return fnStr;
}

// this function will turn a string like "hi {user}" into an array that looks something like "["hi", "{user}"] so we can loop over the array elements
// when compiling the template
var parse = (template) => {
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