export const compileToString = (template) => {
    const ast = parse(template);
    let fnStr = `\`\``;

    ast.map(t => {
        // checking to see if it is an interpolation
        if (t.startsWith("{") && t.endsWith("}")) {
            // append it to fnStr
            const uuid = t.split(/{|}/).filter(Boolean)[0].trim().split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
            fnStr = fnStr.substring(0, fnStr.length - 1) + `<span data-token-${uuid}>\``;
            fnStr += `+appState.contents.${t.split(/{|}/).filter(Boolean)[0].trim()}`;
        } else {
            // append the string to the fnStr
            fnStr += `+\`${t}\``;
        }
    });

    return fnStr;
}

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