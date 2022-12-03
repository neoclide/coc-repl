const {EventEmitter} = require('events')
const {getPort, uid} = require('./util')
const net = require('net')
const path = require('path')
const os = require('os')

const isWindows = process.platform === 'win32'
module.exports = class SocketServer extends EventEmitter {
  #usePipe
  #port
  #server
  constructor(usePipe, port) {
    super()
    this.#usePipe = usePipe === true
    this.#port = port
  }

  async listen() {
    let port = this.#port
    if (!this.#usePipe && typeof port !== 'number') port = await getPort()
    let promise = new Promise((resolve, reject) => {
      let server = this.#server = net.createServer(socket => {
        this.emit('connect', socket)
      })
      server.on('error', reject)
      if (this.#usePipe) {
        let socket = path.join(os.tmpdir(), `coc-repl-${uid(5)}.sock`)
        server.listen(socket, () => {
          resolve(isWindows ? path.join('\\\\?\\pipe', socket) : socket)
        })
      } else {
        let localhost = '127.0.0.1'
        server.listen(port, localhost, () => {
          resolve(`${localhost}:${port}`)
        })
      }
    })
    return await promise
  }

  close() {
    if (this.#server) this.#server.close()
  }
}
