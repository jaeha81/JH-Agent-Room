const fs = require('fs')
const http = require('http')
const path = require('path')
const crypto = require('crypto')

function loadEnvFile() {
  const envFile = path.join(__dirname, '.env')
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
    const [name, ...rest] = line.split('=')
    if (!process.env[name.trim()]) process.env[name.trim()] = rest.join('=').trim()
  }
}

loadEnvFile()

const PORT = Number(process.env.PORT || 3100)
const SHARED_DIR = process.env.AGENT_ROOM_SHARED_DIR || 'G:\\내 드라이브\\JH-SHARED'
const LOG_FILE = path.join(SHARED_DIR, 'agent-room-messages.jsonl')
const PUBLIC_DIR = path.join(__dirname, 'public')

const syncTargets = [
  { label: 'JH-SHARED 시스템 브리핑', file: path.join(SHARED_DIR, 'jh-system.md') },
  { label: 'JH-SHARED 경로 명세', file: path.join(SHARED_DIR, 'paths.md') },
  { label: 'Codex 마스터 상태', file: 'G:\\내 드라이브\\codex\\CODEX_MASTER_STATUS.md' },
  { label: 'Codex 운영 규칙', file: 'G:\\내 드라이브\\codex\\CODEX_OPERATING_RULES.md' },
  { label: 'Obsidian Vault 인덱스', file: 'C:\\Users\\user1\\Documents\\Obsidian Vault\\wiki\\index.md' },
  { label: 'Obsidian Vault 로그', file: 'C:\\Users\\user1\\Documents\\Obsidian Vault\\wiki\\log.md' },
]

const starterMessages = [
  ['user', 'direction', 'JH 통합 구축 시스템 기준으로 Claude와 Codex가 같은 맥락을 보고 역할을 분담한다.', '2026-04-29T20:16:00.000+09:00'],
  ['claude', 'implementation', 'GitHub는 코드, Google Drive는 자료, Obsidian Vault는 지식 허브로 분리해 작업한다.', '2026-04-29T20:18:00.000+09:00'],
  ['codex', 'review', 'Codex는 Claude 구현물을 자동 수정하지 않고 독립 검수 결과를 사용자에게 직접 보고한다.', '2026-04-29T20:19:00.000+09:00'],
]

function ensureStore() {
  fs.mkdirSync(SHARED_DIR, { recursive: true })
  if (!fs.existsSync(LOG_FILE)) {
    for (const [speaker, kind, body, createdAt] of starterMessages) {
      appendMessage({ speaker, kind, body, createdAt })
    }
  }
}

function appendMessage({ speaker, kind, body, createdAt = new Date().toISOString() }) {
  const message = {
    id: crypto.randomUUID(),
    speaker,
    kind,
    body,
    createdAt,
  }
  fs.appendFileSync(LOG_FILE, JSON.stringify(message) + '\n', 'utf8')
  return message
}

function readMessages() {
  ensureStore()
  const raw = fs.readFileSync(LOG_FILE, 'utf8').trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

function statusSnapshot() {
  return syncTargets.map((target) => {
    try {
      const stat = fs.statSync(target.file)
      return { label: target.label, exists: true, updatedAt: stat.mtime.toISOString() }
    } catch {
      return { label: target.label, exists: false, updatedAt: null }
    }
  })
}

function safePayload() {
  return {
    messages: readMessages(),
    syncTargets: statusSnapshot(),
    storage: 'JH-SHARED / agent-room-messages.jsonl',
    agentPostingEnabled: Boolean(process.env.ADMIN_SECRET),
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) {
        reject(new Error('request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath)
  const type = ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  })
}

async function handleMessagePost(req, res) {
  try {
    const input = JSON.parse(await readBody(req))
    const speaker = input.speaker || 'user'
    const kind = input.kind || 'direction'
    const body = typeof input.body === 'string' ? input.body.trim() : ''

    if (!body) return sendJson(res, 400, { error: 'body is required' })
    if (!['direction', 'implementation', 'review', 'sync'].includes(kind)) return sendJson(res, 400, { error: 'invalid kind' })
    if (!['user', 'claude', 'codex'].includes(speaker)) return sendJson(res, 400, { error: 'invalid speaker' })

    if (speaker !== 'user') {
      const secret = req.headers['x-admin-secret']
      if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return sendJson(res, 401, { error: 'Unauthorized' })
      }
    }

    appendMessage({ speaker, kind, body })

    if (kind === 'sync' || body.includes('동기화')) {
      const targets = statusSnapshot()
      const okCount = targets.filter((target) => target.exists).length
      appendMessage({ speaker: 'claude', kind: 'implementation', body: `동기화 요청 접수. 공유 기준 ${targets.length}개 중 ${okCount}개가 현재 PC에서 확인되었습니다.` })
      appendMessage({ speaker: 'codex', kind: 'review', body: '검수 기준: JH-SHARED, Codex 운영 문서, Obsidian Vault, GitHub 상태를 대조한 뒤 사용자에게 직접 보고합니다.' })
    }

    sendJson(res, 201, safePayload())
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid request' })
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/messages' && req.method === 'GET') return sendJson(res, 200, safePayload())
  if (url.pathname === '/api/messages' && req.method === 'POST') return void handleMessagePost(req, res)
  if (url.pathname === '/api/status' && req.method === 'GET') return sendJson(res, 200, {
    syncTargets: statusSnapshot(),
    storage: 'JH-SHARED / agent-room-messages.jsonl',
    agentPostingEnabled: Boolean(process.env.ADMIN_SECRET),
  })

  const filePath = url.pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.normalize(path.join(PUBLIC_DIR, url.pathname))
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  sendFile(res, filePath)
})

ensureStore()
server.listen(PORT, () => {
  console.log(`JH Agent Room running at http://localhost:${PORT}`)
})
