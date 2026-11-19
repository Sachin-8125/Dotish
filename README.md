# Dotish — VS Code extension

A small VS Code extension that removes recognized comments from the active editor in a **single undoable edit**. It is designed to cover common source and configuration formats, including C/C++, JavaScript/TypeScript, HTML/XML, CSS/SCSS, Python, Ruby, shell, SQL, Rust, Go, Java, C#, YAML, TOML, Lua, and several others.

## Install locally

1. Create a folder named `dotish`.
2. Save `extension.js`, `package.json`, and this README in that folder.
3. Open the folder in VS Code and press **F5** to launch an Extension Development Host.
4. In the host, open a file and run **Comments: Delete All Comments** from the Command Palette. Shortcut: **Ctrl+Alt+Shift+C** (macOS: **Cmd+Alt+Shift+C**).

To package for normal installation, install `vsce` (`npm install -g @vscode/vsce`) and run `vsce package` from the extension folder; then use **Extensions: Install from VSIX...** in VS Code.

## Behavior and safety

- Uses the active document's VS Code language ID and file extension to select comment markers.
- Skips quoted strings so text such as `"https://example.com/*not a comment*/"` is retained.
- Keeps line breaks and replaces comment characters with spaces. This avoids accidentally joining adjacent tokens and keeps source line numbers stable.
- Applies the result as one Workspace Edit, so **Ctrl+Z** restores the original text.
- HTML/XML/Markdown-like documents remove HTML comments, including `<script>` / `<style>` regions when they contain JavaScript or CSS.
- Preserves shebang lines and Dockerfile parser directives. For shell, YAML, INI/properties, Dockerfile and Makefile, ambiguous inline `#` / `;` text is left alone rather than risking data loss.

## Important limitations

There is no universal comment syntax for an arbitrary file. For languages with no recognized VS Code language ID or extension, the extension deliberately uses a no-comment fallback rather than guessing and corrupting data. Add that language's syntax to `PROFILE_BY_LANGUAGE` / `EXT_PROFILE` and a matching scanner profile to support it. Comment-like text in regex literals, language-specific raw strings, preprocessor edge cases, or embedded syntaxes may need a dedicated parser for perfect accuracy; this lightweight extension uses a lexer-style scanner, not a full language parser. Review the edit and undo if needed.

## Supported syntax families

- C-style `//` and `/* ... */`: JS/TS, C/C++, Java, C#, Go, SCSS/LESS, JSONC and related languages. Plain CSS uses only `/* ... */`; PHP also supports `#`.
- Rust uses `//` and `/* ... */` while preserving lifetimes and character literals.
- Hash `#`: Python, Ruby, Perl, R and TOML anywhere; shell, YAML, Dockerfile and Makefile use safer position rules; INI/properties also support `;`.
- `--`: SQL, Lua and Haskell. Lua uses `--[[ ... ]]` and Haskell uses `{- ... -}` for block comments.
- `<!-- ... -->`: HTML, XML and Markdown, including embedded `<script>` / `<style>` regions.
- Additional profiles: MATLAB, Elixir, INI/properties, batch, and Visual Basic.
