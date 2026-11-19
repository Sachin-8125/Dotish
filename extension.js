const vscode = require('vscode');

const PROFILES = {
    cLike: { line: ['//'], block: [['/*', '*/']], quotes: ['"', "'", '`'] },
    css: { line: [], block: [['/*', '*/']], quotes: ['"', "'"] },
    php: { line: ['//', '#'], block: [['/*', '*/']], quotes: ['"', "'", '`'] },
    rust: { line: ['//'], block: [['/*', '*/']], quotes: ['"'], apostropheMode: 'char' },
    hash: { line: ['#'], block: [], quotes: ['"', "'", '`'], lineMode: 'anywhere' },
    shell: { line: ['#'], block: [], quotes: ['"', "'", '`'], lineMode: 'shell' },
    yaml: { line: ['#'], block: [], quotes: ['"', "'"], lineMode: 'whitespace' },
    lineHash: { line: ['#'], block: [], quotes: ['"', "'", '`'], lineMode: 'lineStart' },
    dockerfile: { line: ['#'], block: [], quotes: ['"', "'", '`'], lineMode: 'lineStart', keepComment: /^#\s*(?:syntax|escape)\s*=/i },
    sql: { line: ['--'], block: [['/*', '*/']], quotes: ["'", '"', '`', '['] },
    html: { line: [], block: [['<!--', '-->']], quotes: ['"', "'"] },
    lua: { line: ['--'], block: [['--[[', ']]']], quotes: ['"', "'", '`'] },
    haskell: { line: ['--'], block: [['{-', '-}']], quotes: ['"'], apostropheMode: 'char' },
    matlab: { line: ['%'], block: [['%{', '%}']], quotes: ["'", '"'] },
    elixir: { line: ['#'], block: [], quotes: ['"', "'", '`'] },
    ini: { line: [';', '#'], block: [], quotes: ['"', "'"], lineMode: 'lineStart' },
    bat: { line: ['REM ', 'REM\t', '::'], block: [], quotes: ['"'], lineMode: 'lineStart', lineCaseInsensitive: true },
    vb: { line: ["'"], block: [], quotes: ['"'] },
    plain: { line: [], block: [], quotes: ['"', "'", '`'] }
};

const PROFILE_BY_LANGUAGE = {
    javascript: 'cLike', javascriptreact: 'cLike', typescript: 'cLike', typescriptreact: 'cLike',
    java: 'cLike', c: 'cLike', cpp: 'cLike', csharp: 'cLike', go: 'cLike', objectivec: 'cLike',
    'objective-c': 'cLike', 'objective-cpp': 'cLike', swift: 'cLike', kotlin: 'cLike', scala: 'cLike',
    dart: 'cLike', php: 'php', css: 'css', scss: 'cLike', less: 'cLike', jsonc: 'cLike',
    solidity: 'cLike', python: 'hash', ruby: 'hash', perl: 'hash', r: 'hash', toml: 'hash',
    shellscript: 'shell', yaml: 'yaml', dockerfile: 'dockerfile', makefile: 'lineHash',
    sql: 'sql', html: 'html', xml: 'html', markdown: 'html', vue: 'html', svelte: 'html',
    lua: 'lua', haskell: 'haskell', matlab: 'matlab', elixir: 'elixir',
    ini: 'ini', properties: 'ini', bat: 'bat', vb: 'vb', plaintext: 'plain'
};

const EXT_PROFILE = {
    '.js': 'cLike', '.jsx': 'cLike', '.ts': 'cLike', '.tsx': 'cLike', '.java': 'cLike', '.c': 'cLike', '.h': 'cLike',
    '.cc': 'cLike', '.cpp': 'cLike', '.hpp': 'cLike', '.cs': 'cLike', '.go': 'cLike', '.rs': 'rust', '.swift': 'cLike',
    '.kt': 'cLike', '.kts': 'cLike', '.dart': 'cLike', '.php': 'php', '.css': 'css', '.scss': 'cLike', '.less': 'cLike',
    '.jsonc': 'cLike', '.mm': 'cLike', '.py': 'hash', '.rb': 'hash', '.pl': 'hash', '.r': 'hash', '.toml': 'hash',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell', '.ksh': 'shell', '.fish': 'shell',
    '.yaml': 'yaml', '.yml': 'yaml', '.dockerfile': 'dockerfile', '.mk': 'lineHash',
    '.sql': 'sql', '.html': 'html', '.htm': 'html', '.xml': 'html', '.md': 'html',
    '.lua': 'lua', '.hs': 'haskell', '.m': 'matlab', '.ex': 'elixir', '.exs': 'elixir',
    '.ini': 'ini', '.properties': 'ini', '.cfg': 'ini', '.bat': 'bat', '.cmd': 'bat', '.vb': 'vb'
};

function profileFor(document) {
    const id = document.languageId.toLowerCase();
    const ext = require('path').extname(document.fileName).toLowerCase();
    return PROFILES[PROFILE_BY_LANGUAGE[id] || EXT_PROFILE[ext] || 'plain'];
}

function lineHasOnlyWhitespaceBefore(text, index) {
    for (let i = index - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '\n' || ch === '\r') return true;
        if (!/\s/.test(ch)) return false;
    }
    return true;
}

function lineCommentAllowed(text, index, mode = 'anywhere') {
    if (mode === 'whitespace') return index === 0 || /\s/.test(text[index - 1]);
    if (mode === 'lineStart') return lineHasOnlyWhitespaceBefore(text, index);
    if (mode === 'shell') return index === 0 || /[\s;|&()]/.test(text[index - 1]);
    return true;
}

function charLiteralEnd(text, index) {
    let j = index + 1;
    if (j >= text.length) return -1;
    if (text[j] === '\\') {
        j++;
        if (text[j] === 'u' && text[j + 1] === '{') {
            j += 2;
            while (j < text.length && text[j] !== '}') j++;
            if (text[j] !== '}') return -1;
            j++;
        } else {
            if (j >= text.length) return -1;
            j++;
        }
        return text[j] === "'" ? j + 1 : -1;
    }
    const first = text.codePointAt(j);
    if (first === undefined) return -1;
    const charLength = first > 0xffff ? 2 : 1;
    return text[j + charLength] === "'" ? j + charLength + 1 : -1;
}

function blankComment(text, start, end) {
    return text.slice(start, end).replace(/[^\r\n]/g, ' ');
}

function stripWithProfile(text, profile) {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i];

        if (ch === "'" && profile.apostropheMode === 'char') {
            const end = charLiteralEnd(text, i);
            if (end > 0) {
                out += text.slice(i, end);
                i = end;
                continue;
            }
            out += ch;
            i++;
            continue;
        }

        if (profile.quotes.includes(ch)) {
            const quote = ch;
            let j = i + 1;
            if (quote === '[') {
                while (j < text.length) {
                    if (text[j] === ']') {
                        if (text[j + 1] === ']') { j += 2; continue; }
                        j++;
                        break;
                    }
                    j++;
                }
            } else {
                while (j < text.length) {
                    if (text[j] === '\\') { j += 2; continue; }
                    if (text[j] === quote) { j++; break; }
                    j++;
                }
            }
            out += text.slice(i, j);
            i = j;
            continue;
        }

        let matched = null;
        for (const [open, close] of profile.block) {
            if (text.startsWith(open, i)) { matched = { open, close, kind: 'block' }; break; }
        }
        if (!matched) {
            for (const marker of [...profile.line].sort((a, b) => b.length - a.length)) {
                const matches = profile.lineCaseInsensitive
                    ? text.slice(i, i + marker.length).toLowerCase() === marker.toLowerCase()
                    : text.startsWith(marker, i);
                if (!matches || !lineCommentAllowed(text, i, profile.lineMode)) continue;
                matched = { open: marker, kind: 'line' };
                break;
            }
        }

        if (!matched) { out += ch; i++; continue; }
        const start = i;
        if (matched.kind === 'line') {
            let end = i + matched.open.length;
            while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
            const commentText = text.slice(start, end);
            const keep = (start === 0 && commentText.startsWith('#!')) ||
                (profile.keepComment && profile.keepComment.test(commentText));
            out += keep ? commentText : blankComment(text, start, end);
            i = end;
        } else {
            let end = text.indexOf(matched.close, i + matched.open.length);
            end = end < 0 ? text.length : end + matched.close.length;
            out += blankComment(text, start, end);
            i = end;
        }
    }
    return out;
}

function tagAttribute(tag, name) {
    const match = tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\']?([^"\'\\s>]+)', 'i'));
    return match ? match[1] : '';
}

function embeddedProfileFor(tag, tagName) {
    const type = tagAttribute(tag, 'type');
    if (tagName === 'style') {
        if (type && !/css/i.test(type)) return null;
        return PROFILES.cLike;
    }
    if (!type || /module|javascript|ecmascript|babel|jsx|tsx/i.test(type)) return PROFILES.cLike;
    return null;
}

function stripHtmlDocument(text) {
    let output = '';
    let cursor = 0;
    const tokenRe = /<!--|<(script|style)\b[^>]*>/ig;
    let match;
    while ((match = tokenRe.exec(text))) {
        if (match[0].startsWith('<!--')) {
            const close = text.indexOf('-->', tokenRe.lastIndex);
            const end = close < 0 ? text.length : close + 3;
            output += stripWithProfile(text.slice(cursor, match.index), PROFILES.html);
            output += blankComment(text, match.index, end);
            cursor = end;
            tokenRe.lastIndex = end;
            continue;
        }

        const tagName = match[1].toLowerCase();
        const closeRe = new RegExp('</' + tagName + '\\s*>', 'ig');
        closeRe.lastIndex = tokenRe.lastIndex;
        const close = closeRe.exec(text);
        if (!close) break;
        const embedded = embeddedProfileFor(match[0], tagName);
        output += stripWithProfile(text.slice(cursor, match.index), PROFILES.html);
        output += match[0];
        const bodyStart = tokenRe.lastIndex;
        output += embedded
            ? stripWithProfile(text.slice(bodyStart, close.index), embedded)
            : text.slice(bodyStart, close.index);
        output += close[0];
        cursor = closeRe.lastIndex;
        tokenRe.lastIndex = cursor;
    }
    output += stripWithProfile(text.slice(cursor), PROFILES.html);
    return output;
}

function activate(context) {
    const disposable = vscode.commands.registerTextEditorCommand('deleteAllComments.remove', async editor => {
        const document = editor.document;
        if (document.isClosed) return;
        const original = document.getText();
        const profile = profileFor(document);
        const result = (['html', 'xml', 'markdown', 'vue', 'svelte'].includes(document.languageId.toLowerCase()) ||
            ['.html', '.htm', '.xml', '.md', '.vue', '.svelte'].includes(require('path').extname(document.fileName).toLowerCase()))
            ? stripHtmlDocument(original)
            : stripWithProfile(original, profile);
        if (result === original) {
            vscode.window.setStatusBarMessage('Delete All Comments: no comments found.', 2500);
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        const wholeFile = new vscode.Range(document.positionAt(0), document.positionAt(original.length));
        edit.replace(document.uri, wholeFile, result);
        const applied = await vscode.workspace.applyEdit(edit);
        if (applied) vscode.window.setStatusBarMessage('All recognized comments removed (undo with Ctrl+Z).', 4000);
        else vscode.window.showErrorMessage('Could not remove comments from this document.');
    });
    context.subscriptions.push(disposable);
}

function deactivate() { }
module.exports = { activate, deactivate, stripWithProfile, stripHtmlDocument };
