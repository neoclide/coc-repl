const fs = require('fs')
const os = require('os')
const net = require('net')
const path = require('path')
const Module = require('module')

let currPort = 6000

exports.toExtensions = arr => {
  let res = new Set()
  arr.forEach(str => {
    if (!str) return
    if (str === '.') {
      res.add(process.cwd())
    } else {
      str = expandPath(str)
      if (fs.existsSync(str)) {
        res.add(str)
      }
    }
  })
  return Array.from(res)
}

exports.ensureFolder = function (filepath) {
  if (!filepath || !path.isAbsolute(filepath)) return
  let dir = path.dirname(filepath)
  if (!fs.existsSync(filepath)) {
    fs.mkdirSync(dir, {recursive: true})
  }
  return filepath
}

exports.getPort = function () {
  let port = currPort
  let fn = cb => {
    let server = net.createServer()
    server.listen(port, () => {
      server.once('close', () => {
        currPort = port + 1
        cb(port)
      })
      server.close()
    })
    server.on('error', () => {
      port += 1
      fn(cb)
    })
  }
  return new Promise(resolve => {
    fn(resolve)
  })
}

const redOpen = '\x1B[31m'
const redClose = '\x1B[39m'
const logError = exports.logError = function (message) {
  console.error(`${redOpen}${message}${redClose}`)
}

exports.notExists = function (filepath) {
  logError(`File ${filepath} not exists`)
}

const expandPath = exports.expandPath = function expandPath(filepath) {
  if (!filepath) return undefined
  filepath = filepath.replace(/^~/, os.homedir())
  if (path.isAbsolute(filepath)) return filepath
  return path.join(process.cwd(), filepath)
}

exports.isDirectory = function (filepath) {
  if (!fs.existsSync(filepath)) return false
  let stat = fs.statSync(filepath)
  return stat && stat.isDirectory()
}

exports.uid = function (length) {
  let result = ''
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

exports.builtinModules = Module.builtinModules
