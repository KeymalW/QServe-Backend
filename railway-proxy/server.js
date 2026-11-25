const http = require('node:http')
const { spawn } = require('node:child_process')

const PORT = Number(process.env.PORT || 8080)
const API_PORT = Number(process.env.API_PORT || 8081)
const WS_PORT = Number(process.env.WS_PORT || 3001)
const HOST = '127.0.0.1'

function startProcess(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    console.error(`${command} exited with code ${code}`)
    process.exit(code ?? 1)
  })
}

function proxyHttp(req, res) {
  const upstream = http.request(
    {
      hostname: HOST,
      port: API_PORT,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
    }
    res.end(JSON.stringify({ ok: false, message: 'upstream unavailable' }))
  })
  req.pipe(upstream)
}

function proxyUpgrade(req, clientSocket, head) {
  const upstream = http.request({
    hostname: HOST,
    port: WS_PORT,
    method: 'GET',
    path: req.url,
    headers: req.headers,
  })

  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamRes.headers).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => `${key}: ${item}`) : [`${key}: ${value}`],
    )
    clientSocket.write(
      `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage || ''}\r\n${headers.join('\r\n')}\r\n\r\n`,
    )
    if (upstreamHead.length) clientSocket.write(upstreamHead)
    if (head.length) upstreamSocket.write(head)
    upstreamSocket.pipe(clientSocket)
    clientSocket.pipe(upstreamSocket)
  })

  upstream.on('error', () => clientSocket.destroy())
  upstream.end()
}

if (process.env.NO_SPAWN !== '1') {
  startProcess('php', ['artisan', 'serve', `--host=${HOST}`, `--port=${API_PORT}`])
  startProcess('node', ['websocket-server/server.js'], {
    PORT: String(WS_PORT),
    BROADCAST_SECRET: process.env.WS_BROADCAST_SECRET || '',
  })
}

const server = http.createServer(proxyHttp)
server.on('upgrade', proxyUpgrade)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`API + WS proxy listening on ${PORT} (api=${API_PORT}, ws=${WS_PORT})`)
})
