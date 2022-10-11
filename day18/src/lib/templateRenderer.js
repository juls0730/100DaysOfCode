export const compileToString = async (template) => {
    let styles = ``

    const style = parseFromRegex(template, /<style>|<\/style>/g)

    style.map(async (style, i, arr) => {
        if (!style || !arr[i + 2]) return
        if (style.startsWith('<style>') && arr[i + 2].startsWith('</style>')) {
            styles += arr[i + 1]
        }

        // remove the style from the body
        template = template.split('<style>' + styles + '</style>').join('')
    })

    let script = ``

    const scriptContent = parseFromRegex(template, /<script>|<\/script>/g)

    scriptContent.map(async (scriptData, i, arr) => {
        if (!scriptData || !arr[i + 2]) return
        if (scriptData.startsWith('<script') && arr[i + 2].startsWith('</script>')) {
            script += arr[i + 1]
        }

        // remove the style from the body
        template = template.split('<script>' + script + '</script>').join('')
    })

    let ast = parseFromRegex(template, /{(.*?)}/g);
    let fnStr = `\`\``;

    ast.map(async t => {
        // checking to see if it is an interpolation
        if (t.startsWith("{") && t.endsWith("}")) {
            // TODO: rewrite comment
            let bracketVariable = t.split(/{|}/).filter(Boolean)[0].trim();
            const parentElement = fnStr.split(t)[0].split('>')
            const isRawHTML = parentElement[parentElement.length - 2].includes('d-html')
            if (bracketVariable.startsWith("appState.contents.")) {
                const uuid = bracketVariable.substring(bracketVariable.length, 18).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
                fnStr = fnStr.substring(0, fnStr.length - 1) + `<span data-token-${uuid}>\``;
            } else {
                fnStr = fnStr.substring(0, fnStr.length - 1) + `<span>\``;
            }
            let runVar = `((${bracketVariable}).toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'))`

            if (isRawHTML) {
                runVar = `(${bracketVariable})`
            }

            fnStr += `+ (${runVar})` + `+\`</span>\``;
        } else {
            // append the string to the fnStr
            fnStr += `+\`${t}\``;
        }
    });

    if (import.meta.env.VITE_VERBOSE && !import.meta.env.PROD && !import.meta.env.SSR) {
        console.groupCollapsed('Compiled tempalte to String')
        console.info('Template String: ' + fnStr)
        console.groupEnd()
    }


    return { fnStr, styles, script };
}

const parseFromRegex = (template, regex) => {
    let result = regex.exec(template);
    const arr = []
    let firstPos

    while (result) {
        firstPos = result.index
        if (firstPos !== 0) {
            arr.push(template.substr(0, firstPos))
            template = template.slice(firstPos)
        }

        arr.push(result[0])
        template = template.slice(result[0].length)
        result = regex.exec(template)
    }

    if (template) arr.push(template)
    return arr
}

export const render = (template) => {
    return compileToString(template)
}