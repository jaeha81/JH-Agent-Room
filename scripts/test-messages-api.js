const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-agent-room-test-'))
const sharedDir = path.join(tempRoot, 'JH-SHARED')
const logDir = path.join(sharedDir, '01_AGENT_ROOM')
const logsDir = path.join(sharedDir, '03_LOGS')
const systemDir = path.join(sharedDir, '00_SYSTEM')
const port = 43100 + Math.floor(Math.random() * 1000)

fs.mkdirSync(logDir, { recursive: true })
fs.mkdirSync(logsDir, { recursive: true })
fs.mkdirSync(systemDir, { recursive: true })

const logFile = path.join(logDir, 'agent-room-messages.jsonl')
fs.writeFileSync(logFile, [
  JSON.stringify({
    id: 'valid-1',
    speaker: 'user',
    kind: 'direction',
    target: 'room',
    status: 'done',
    body: '정상 메시지',
    createdAt: '2026-05-12T00:00:00.000Z',
    taskType: 'question',
    loopId: 'valid-1',
  }),
  JSON.stringify({
    id: 'overdue-reminded',
    speaker: 'codex',
    kind: 'review',
    target: 'codex',
    status: 'todo',
    body: 'Already reminded review',
    createdAt: '2026-05-12T00:05:00.000Z',
    taskType: 'review',
    loopId: 'overdue-reminded',
    reviewDeadline: '2026-05-12T00:10:00.000Z',
  }),
  JSON.stringify({
    id: 'reminder-for-overdue-reminded',
    speaker: 'claude',
    kind: 'direction',
    target: 'both',
    status: 'todo',
    body: '[Codex reminder] Already sent.',
    createdAt: '2026-05-12T00:20:00.000Z',
    taskType: 'review',
    loopId: 'overdue-reminded',
    replyTo: 'overdue-reminded',
  }),
  JSON.stringify({
    id: 'overdue-open',
    speaker: 'codex',
    kind: 'review',
    target: 'codex',
    status: 'todo',
    body: 'Needs first reminder',
    createdAt: '2026-05-12T00:06:00.000Z',
    taskType: 'review',
    loopId: 'overdue-open',
    reviewDeadline: '2026-05-12T00:10:00.000Z',
  }),
  JSON.stringify({
    id: 'overdue-second',
    speaker: 'codex',
    kind: 'review',
    target: 'codex',
    status: 'todo',
    body: 'Second open reminder',
    createdAt: '2026-05-12T00:07:00.000Z',
    taskType: 'review',
    loopId: 'overdue-second',
    reviewDeadline: '2026-05-12T00:10:00.000Z',
  }),
  JSON.stringify({
    timestamp: '2026-05-12T01:44:35',
    from: 'codex',
    to: 'claude',
    type: 'briefing',
    topic: 'legacy-log-without-body',
    summary: 'This legacy record must not crash /api/messages.',
  }),
].join('\n') + '\n', 'utf8')

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      } : undefined,
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: raw }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function waitForServer(child) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      if (child.exitCode !== null) {
        clearInterval(timer)
        reject(new Error(`server exited early with code ${child.exitCode}`))
        return
      }
      if (Date.now() - started > 7000) {
        clearInterval(timer)
        reject(new Error('server did not start in time'))
        return
      }
      try {
        const response = await request('GET', '/api/messages')
        clearInterval(timer)
        resolve(response)
      } catch {
        // keep polling
      }
    }, 150)
  })
}

(async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      AGENT_ROOM_SHARED_DIR: sharedDir,
      AGENT_ROOM_AUTO_REPLY: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    const first = await waitForServer(child)
    if (first.status !== 200) throw new Error(`GET /api/messages expected 200, got ${first.status}: ${first.body}`)
    const payload = JSON.parse(first.body)
    if (!Array.isArray(payload.messages)) throw new Error('GET /api/messages did not return messages array')
    if (payload.messages.some((message) => !message.body)) throw new Error('legacy record leaked into messages payload')

    const post = await request('POST', '/api/messages', JSON.stringify({
      speaker: 'user',
      kind: 'review',
      target: 'codex',
      taskType: 'review',
      body: 'Codex 전용 패널 테스트 메시지',
    }))
    if (post.status !== 201) throw new Error(`POST /api/messages expected 201, got ${post.status}: ${post.body}`)
    const posted = JSON.parse(post.body)
    const routedUser = posted.messages.find((message) => message.body === 'Codex 전용 패널 테스트 메시지')
    if (!routedUser || routedUser.speaker !== 'user' || routedUser.target !== 'codex' || routedUser.kind !== 'review') {
      throw new Error('Codex review message was not routed correctly')
    }

    const overdue = await request('GET', '/api/overdue-reviews?limit=1')
    if (overdue.status !== 200) throw new Error(`GET /api/overdue-reviews expected 200, got ${overdue.status}: ${overdue.body}`)
    const overduePayload = JSON.parse(overdue.body)
    if (overduePayload.count !== 2) throw new Error(`overdue count should exclude already reminded reviews, got ${overduePayload.count}`)
    if (overduePayload.returned !== 1) throw new Error(`overdue returned should respect limit=1, got ${overduePayload.returned}`)
    if (overduePayload.items.some((item) => item.id === 'overdue-reminded')) {
      throw new Error('already reminded review leaked into overdue reviews')
    }
    if (overduePayload.items[0]?.id !== 'overdue-open') {
      throw new Error(`oldest unreminded overdue review should be returned first, got ${overduePayload.items[0]?.id}`)
    }

    console.log('messages api test passed')
  } finally {
    child.kill()
    fs.rmSync(tempRoot, { recursive: true, force: true })
    if (stderr) process.stderr.write(stderr)
  }
})().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
