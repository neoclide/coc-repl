# coc-repl

Read-Eval-Print-Loop (REPL) for coc.nvim, which makes experiment with API of
coc.nvim much easier.

This module provide an executable which start a server and you can start a vim
or neovim to connect to it. When connected, coc.nvim module would be loaded and
attached with vim and a REPL server would be started which allows the user to
execute javascript code with the
[exports from coc.nvim](https://github.com/neoclide/coc.nvim/blob/master/typings/index.d.ts#L3)
as current context.

Additional supports:

- Load extension by command line argument or use command `.load`.
- Source javascript code with coc.nvim exports as globals.
- Reconnect to the server by vim command `:CocRestart`.
- Trace events of coc.nvim with current console.
- Show debug messages of the node-client with current console, mostly the transport messages.
- Trace verbose output from `LanguageClient` with current console.

**Important**, latest coc.nvim is required.

## Install

    npm i -g coc-repl

Or use `npx coc-repl` to install and run the command.

## Usage

Run `coc-repl --help` to get help like:

```sh
coc-repl [options]

Start REPL server with coc.nvim exports as global context

Options:
  -h, --help      Show help                                            [boolean]
      --version   Show version number                                  [boolean]
  -p, --port      Tcp port of the socket server to listen on.           [number]
      --pipe      Use socket pipe for server instead of tcp port.      [boolean]
      --noplugin  Not load any coc.nvim extensions, except extensions specified
                  by --load option.                                    [boolean]
      --noconfig  Not load user configuration file of coc.nvim         [boolean]
  -C, --clean     Not load coc.nvim extensions and user configuration file, same
                  as --noplugin --noconfig                             [boolean]
  -L, --load      Load and activate coc.nvim extension from specified filepath,
                  filepath could be folder or file, use "." to load current
                  directory.                               [array] [default: []]
      --trace     Enable use current stdio to trace coc.nvim events and other
                  log messages.                                        [boolean]
  -v, --verbose   Enable use current stdio to show verbose messages of the node
                  client.                                              [boolean]
```

A terminal with ANSI color support is need for `--trace` and `--verbose` option,
and press `<cr>` when the output make the prompt disappear.

Without `--port` nad `--pipe`, a valid port from 6000 would be picked to start
the server.

## Custom REPL commands

- `.switchConsole` use current console as logger of coc.nvim or not.
- `.q` Exit program.
- `.source filepath` execute the javascript code in filepath, could be relative
  or absolute filepath, the code is executed with the context contains exports
  from coc.nvim.
- `.load filepath` load coc.nvim extension from filepath, could be folder or
  file, could be absolute path or path relative to current cwd.
- `.trace LanguageClientId` trace output of language client by id, the
  language client should be registered, get the id by `:CocList services`,
  support for language clients only, services like tsserver not supported.

Check out the available REPL commands at https://nodejs.org/api/repl.html#commands-and-special-keys.

Check out the keybindings at https://nodejs.org/api/readline.html#tty-keybindings.

The REPL history is saved to file `~/.coc-repl-history`, use `<C-r>` and `<C-s>`
to search history.

## Examples

Variable `nvim` is exported as the vim client. To get current buffer, use

    await nvim.buffer

Use `_` to access the result of the most recently evaluated expression.

Activate extension in current cwd only, use command:

    coc-repl --noplugin -L .

The last loaded extension by `-L` and `.load` command can be accessed by
variable `ext`, which defined as:

```typescript
interface ExportedExtension {
  readonly name: string
  /*
   * Is true when activated.
   */
  readonly isActive: boolean
  /*
   * Unload this extension.
   */
  unload: () => Promise<void>
  /**
   * API returned by activate function
   */
  readonly api: any
  /**
   * The object of module.exports from the extension entry without activate & deactivate function.
   */
  readonly exports: any
}
```

## TIPS

When restart coc-repl process, it's possible to reconnect the server by
`:CocRestart` when the connection address not changed (no need to reopen vim).

The REPL context and coc.nvim would be reloaded when new client connected, so
you can switch between vim and neovim without restart coc-repl.

## LICENSE

Copyright 2022 chemzqm@gmail.com

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
