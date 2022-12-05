const os = require('os')
const fs = require('fs')
const path = require('path')
const repl = require('repl')
const Module = require('module')
const vm = require('vm')
const {decode} = require('@chemzqm/msgpack-lite')
const {toExtensions, builtinModules, notExists, logError, expandPath} = require('./util')
const SocketServer = require('./server')

function setUpEnv(args, options) {
  process.env.COC_TESTER = '1'
  if (args.noconfig) {
    process.env.COC_VIMCONFIG = 'INVALID_FOLDER'
  } else {
    process.env.COC_VIMCONFIG = options.configHome
  }
  process.env.COC_DATA_HOME = options.dataHome
  process.env.VIM_NODE_RPC = options.isVim ? '1' : '0'
  process.env.NVIM_COC_LOG_FILE = options.logFile
  if (args.trace) {
    process.env.NVIM_COC_LOG_LEVEL = 'trace'
  } else {
    process.env.NVIM_COC_LOG_LEVEL = options.logLevel ?? 'trace'
  }
  if (args.noplugin) process.env.COC_NO_PLUGINS = '1'
  if (args.verbose) process.env.COC_NODE_CLIENT_DEBUG = '1'
}

function parseOptions(data) {
  let arr
  let isVim = false
  if (data[0] == 91) {
    isVim = true
    arr = JSON.parse(data.toString('utf8').trim())
  } else if (data[0] == 147) {
    // neovim
    let res = decode(data)
    if (res[1] !== 'init') {
      logError(`Unexpected buffer data`)
      return
    }
    arr = res[2]
  } else {
    logError(`Unexpected buffer data: ${data.toString()}`)
    return
  }
  if (!Array.isArray(arr) || arr.length < 6) {
    logError(`Unexpected parse result: ${arr}`)
    return
  }
  return {
    isVim,
    folder: arr[0],
    dataHome: arr[1],
    configHome: arr[2],
    logFile: arr[3],
    logLevel: arr[4],
    runtimepath: arr[5]
  }
}

async function start(args) {
  const server = new SocketServer(args.pipe, args.port)
  process.on('exit', () => {
    if (server) server.close()
  })
  await new Promise((resolve, reject) => {
    server.listen().then(address => {
      console.log(`connect to coc-repl by "COC_NVIM_REMOTE_ADDRESS=${address} vim"`)
      resolve()
    }, reject)
  })
  let globals
  function initializeContext(context) {
    for (let key of Object.keys(globals ?? {})) {
      context[key] = globals[key]
    }
  }

  let replServer
  let currentLogger
  let load
  let services
  function startRepl() {
    if (replServer) return
    const yellowOpen = '\x1B[33m'
    const yellowClose = '\x1B[39m'
    replServer = repl.start({
      prompt: `${yellowOpen}>${yellowClose} `,
      terminal: true,
      replMode: repl.REPL_MODE_STRICT
    })
    replServer.on('reset', () => {
      initializeContext(replServer.context)
    })
    replServer.on('exit', () => {
      process.exit()
    })
    let historyFile = path.join(os.homedir(), '.coc-repl-history')
    replServer.setupHistory(historyFile, err => {
      if (err) logError(`Unable to setup history file: ${err}`)
    })
    replServer.defineCommand('q', {
      help: 'Exit program',
      action() {
        replServer.close()
      }
    })
    replServer.defineCommand('switchConsole', {
      help: 'Use current console as logger of coc.nvim',
      action() {
        if (currentLogger) currentLogger.switchConsole()
        replServer.displayPrompt()
      }
    })
    replServer.defineCommand('source', {
      help: 'Source absolute filepath or relative file with exports of coc.nvim in global context.',
      async action(filepath) {
        filepath = expandPath(filepath)
        if (!filepath || !fs.existsSync(filepath)) {
          notExists(filepath)
          replServer.displayPrompt()
          return
        }
        let context = Object.assign(global, globals ?? {})
        let sandbox = vm.createContext(context)
        let code = fs.readFileSync(filepath, 'utf8')
        let js = `
        async function __main__() {
        ${code}
        };
        __main__;`
        try {
          let fn = vm.runInContext(js, sandbox, {filename: ''})
          await fn()
          replServer.displayPrompt()
        } catch (e) {
          logError(e.message)
          replServer.displayPrompt()
        }
      }
    })
    replServer.defineCommand('trace', {
      help: 'Trace output of language client by id',
      async action(id) {
        if (!id) {
          // let stats = services.getServiceStats()
          // let ids = stats.map(o => o.id.startsWith('languageserver') ? o.id.slice('languageserver.'.length) : o.id)
          // ids = ids.filter(id => services.getService(id).client != null)
          // if (!ids.length) {
          //   logError('No language client exists')
          //   replServer.displayPrompt()
          //   return
          // }
          // let res = await cliSelect({
          //   values: ids,
          //   valueRenderer: (value, selected) => {
          //     if (selected) return '\x1B[34m' + value + '\x1B[39m'
          //     return value
          //   },
          // }).catch(() => {
          //   return undefined
          // })
          // if (!res) return
          // id = res.value
          // console.log(id)
          logError('language client id required')
          replServer.displayPrompt()
          return
        }
        let service = services.getService(id)
        if (!service || service.client == null) {
          logError(`language client "${id}" not found`)
          replServer.displayPrompt()
          return
        }
        service.client.switchConsole()
        replServer.displayPrompt()
      }
    })
    replServer.defineCommand('load', {
      help: 'Load and activate coc.nvim extension from absolute filepath or file relative to cwd',
      action(filepath) {
        if (load) {
          load(filepath, true).then(ext => {
            replServer.context.ext = ext
            replServer.displayPrompt()
          }, err => {
            logError(err)
            replServer.displayPrompt()
          })
        }
      }
    })
    builtinModules.forEach(key => {
      if (key === 'console') return
      // not complete them
      delete replServer.context[key]
    })
  }

  server.on('connect', socket => {
    socket.once('data', async (data) => {
      let options = parseOptions(data)
      if (!options) return
      const entryFile = path.join(options.folder, 'build/index.js')
      if (!fs.existsSync(entryFile)) {
        logError(`File ${entryFile} not exists, please build coc.nvim`)
        return
      }
      setUpEnv(args, options)
      console.log(`${options.isVim ? 'vim' : 'nvim'} connected`)
      // @ts-ignore
      delete Module._cache[require.resolve(entryFile)]
      const {attach, exports, logger, loadExtension} = require(entryFile)
      currentLogger = logger
      services = exports.services
      if (args.trace) logger.switchConsole()
      let plugin = attach({reader: socket, writer: socket}, false)
      let nvim = plugin.nvim
      socket.once('close', () => {
        nvim.detach()
      })
      await plugin.init(options.runtimepath)
      let ext
      if (Array.isArray(args.load)) {
        let filepaths = toExtensions(args.load)
        for (let file of filepaths) {
          ext = await loadExtension(file, true)
        }
      }
      globals = Object.assign({}, exports, {plugin, nvim})
      if (ext) globals.ext = ext
      load = (filepath, active) => {
        if (!filepath || typeof filepath !== 'string') return Promise.reject(new Error('Invalid filepath'))
        filepath = expandPath(filepath)
        if (!fs.existsSync(filepath)) return Promise.reject(`filepath ${filepath} not exists`)
        return loadExtension(filepath, active === undefined ? true : false)
      }
      startRepl()
      replServer.displayPrompt()
      initializeContext(replServer.context)
    })

    socket.on('error', () => {
      // fired when user close vim
      // console.log(`Error on socket:`, err)
    })

    socket.on('close', () => {
      console.log('client disconnected')
      if (!replServer) return
      replServer.displayPrompt()
      for (let key of Object.keys(globals ?? {})) {
        delete replServer.context[key]
      }
      delete replServer.context.ext
    })
  })
}

exports.start = start
