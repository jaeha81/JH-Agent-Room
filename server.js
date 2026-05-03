const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

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
const OBSIDIAN_VAULT_DIR = process.env.OBSIDIAN_VAULT_DIR || 'G:\\내 드라이브\\OBSIDIAN-SECOND'
const HARNESS_DASHBOARD_URL = process.env.HARNESS_DASHBOARD_URL || 'http://127.0.0.1:3200'
const AUTO_ACK_ENABLED = process.env.AGENT_ROOM_AUTO_ACK !== '0'
const SYSTEM_DIR = path.join(SHARED_DIR, '00_SYSTEM')
const AGENT_ROOM_DIR = path.join(SHARED_DIR, '01_AGENT_ROOM')
const LOGS_DIR = path.join(SHARED_DIR, '03_LOGS')
const LOG_FILE = path.join(AGENT_ROOM_DIR, 'agent-room-messages.jsonl')
const ROUTE_INBOX_DIR = path.join(AGENT_ROOM_DIR, 'inbox')
const ROUTE_PROCESSED_DIR = path.join(AGENT_ROOM_DIR, 'processed')
const ROUTE_FAILED_DIR = path.join(AGENT_ROOM_DIR, 'failed')
const LEGACY_LOG_FILE = path.join(SHARED_DIR, 'agent-room-messages.jsonl')
const SYNC_STATE_FILE = path.join(LOGS_DIR, 'sync-state.jsonl')
const ROUTE_INGEST_LOG = path.join(LOGS_DIR, 'agent-room-route-ingest.jsonl')
const PUBLIC_DIR = path.join(__dirname, 'public')

const syncTargets = [
  { label: '동기화 프로토콜', file: path.join(SYSTEM_DIR, 'sync-protocol.md') },
  { label: 'JH-SHARED 시스템 브리핑', file: path.join(SYSTEM_DIR, 'jh-system.md') },
  { label: 'JH-SHARED 경로 명세', file: path.join(SYSTEM_DIR, 'paths.md') },
  { label: 'Codex 마스터 상태', file: 'G:\\내 드라이브\\codex\\CODEX_MASTER_STATUS.md' },
  { label: 'Codex 운영 규칙', file: 'G:\\내 드라이브\\codex\\CODEX_OPERATING_RULES.md' },
  { label: 'Obsidian Vault 인덱스', file: path.join(OBSIDIAN_VAULT_DIR, 'wiki', 'index.md') },
  { label: 'Obsidian Vault 로그', file: path.join(OBSIDIAN_VAULT_DIR, 'wiki', 'log.md') },
]

const starterMessages = [
  ['user', 'direction', 'JH 통합 구축 시스템 기준으로 Claude와 Codex가 같은 맥락을 보고 역할을 분담한다.', '2026-04-29T20:16:00.000+09:00'],
  ['claude', 'implementation', 'GitHub는 코드, Google Drive는 자료, Obsidian Vault는 지식 허브로 분리해 작업한다.', '2026-04-29T20:18:00.000+09:00'],
  ['codex', 'review', 'Codex는 Claude 구현물을 자동 수정하지 않고 독립 검수 결과를 사용자에게 직접 보고한다.', '2026-04-29T20:19:00.000+09:00'],
]

const allowedTargets = ['room', 'both', 'gpt', 'claude', 'codex', 'harness', 'github', 'local']
const allowedTaskTypes = ['question', 'plan', 'implementation', 'review', 'harness', 'github', 'local', 'browser']
const eventClients = new Set()
let broadcastTimer = null

const targetLabels = {
  room: '공유',
  both: 'Claude+Codex 공동',
  gpt: 'GPT 계획',
  claude: 'Claude',
  codex: 'Codex',
  harness: 'Harness 착수',
  github: 'Codex: GitHub 확인',
  local: 'Codex: 로컬 작업',
}

const taskTypeLabels = {
  question: '새 질문',
  plan: '개발 계획',
  implementation: '구현 지시',
  review: '검증 요청',
  harness: '하네스 착수',
  github: 'GitHub 상태',
  local: '로컬 작업',
  browser: '브라우저/확장',
}

function ensureStore() {
  fs.mkdirSync(SYSTEM_DIR, { recursive: true })
  fs.mkdirSync(AGENT_ROOM_DIR, { recursive: true })
  fs.mkdirSync(LOGS_DIR, { recursive: true })
  fs.mkdirSync(ROUTE_INBOX_DIR, { recursive: true })
  fs.mkdirSync(ROUTE_PROCESSED_DIR, { recursive: true })
  fs.mkdirSync(ROUTE_FAILED_DIR, { recursive: true })

  if (!fs.existsSync(LOG_FILE) && fs.existsSync(LEGACY_LOG_FILE)) {
    fs.copyFileSync(LEGACY_LOG_FILE, LOG_FILE)
  }

  if (!fs.existsSync(LOG_FILE)) {
    for (const [speaker, kind, body, createdAt] of starterMessages) {
      appendMessage({ speaker, kind, body, createdAt })
    }
  }
}

function appendJsonLine(file, payload) {
  fs.appendFileSync(file, JSON.stringify(payload) + '\n', 'utf8')
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function broadcastEvent(event, payload) {
  for (const res of eventClients) {
    try {
      writeEvent(res, event, payload)
    } catch {
      eventClients.delete(res)
    }
  }
}

function scheduleBroadcast(reason = 'updated') {
  if (broadcastTimer) clearTimeout(broadcastTimer)
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null
    broadcastEvent('payload', { reason, ...safePayload() })
  }, 80)
}

function normalizeTarget(_speaker, target) {
  return allowedTargets.includes(target) ? target : 'room'
}

function isRoutedTarget(target) {
  return target && target !== 'room'
}

function normalizeStatus(_speaker, status, target = 'room') {
  if (!isRoutedTarget(target) && status === 'logged') return 'logged'
  return ['todo', 'working', 'review', 'blocked', 'done'].includes(status) ? status : 'todo'
}

function normalizeTaskType(_speaker, taskType) {
  return allowedTaskTypes.includes(taskType) ? taskType : 'question'
}

function normalizeMessageId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function appendMessage({ speaker, kind, body, target = 'room', status = 'todo', taskType = 'question', loopId = null, replyTo = null, autoAck = false, createdAt = new Date().toISOString() }) {
  const normalizedTarget = normalizeTarget(speaker, target)
  const id = crypto.randomUUID()
  const message = {
    id,
    speaker,
    kind,
    target: normalizedTarget,
    status: normalizeStatus(speaker, status, normalizedTarget),
    body,
    createdAt,
  }
  const normalizedTaskType = normalizeTaskType(speaker, taskType)
  message.taskType = normalizedTaskType
  message.loopId = normalizeMessageId(loopId) || normalizeMessageId(replyTo) || id
  const normalizedReplyTo = normalizeMessageId(replyTo)
  if (normalizedReplyTo) message.replyTo = normalizedReplyTo
  if (autoAck) message.autoAck = true
  appendJsonLine(LOG_FILE, message)
  return message
}

function autoAckSpeakers(target, sourceSpeaker = 'user') {
  if (!AUTO_ACK_ENABLED) return []
  const speakers = []
  if (target === 'both') speakers.push('claude', 'codex')
  if (target === 'claude' || target === 'harness') speakers.push('claude')
  if (target === 'codex' || target === 'github' || target === 'local') speakers.push('codex')
  return speakers.filter((speaker) => speaker !== sourceSpeaker)
}

function autoAckKind(speaker) {
  return speaker === 'codex' ? 'review' : 'implementation'
}

function autoAckBody(message, speaker) {
  const role = speaker === 'codex'
    ? 'Codex 검수/확인 큐'
    : 'Claude 구현/운영 큐'
  const target = targetLabels[message.target] || message.target
  const taskType = taskTypeLabels[message.taskType] || message.taskType || '새 질문'
  return [
    '[Agent Room 자동 접수]',
    `${role}에 공유가 라우팅되었습니다.`,
    `발신: ${message.speaker}`,
    `대상: ${target}`,
    `작업 유형: ${taskType}`,
    `원본 ID: ${message.id}`,
    '실제 작업 답변은 담당 에이전트가 큐를 읽고 별도로 남깁니다.',
  ].join('\n')
}

function appendAutoAcks(message) {
  const speakers = autoAckSpeakers(message.target, message.speaker)
  return speakers.map((speaker) => appendMessage({
    speaker,
    kind: autoAckKind(speaker),
    body: autoAckBody(message, speaker),
    loopId: message.loopId,
    replyTo: message.id,
    autoAck: true,
  }))
}

function routeMessage(input, source = 'api') {
  const speaker = input.speaker || 'user'
  const kind = input.kind || 'direction'
  const target = typeof input.target === 'string' ? input.target.trim() : 'room'
  const taskType = typeof input.taskType === 'string' ? input.taskType.trim() : 'question'
  const status = typeof input.status === 'string' ? input.status.trim() : 'todo'
  const loopId = typeof input.loopId === 'string' ? input.loopId.trim() : null
  const replyTo = typeof input.replyTo === 'string' ? input.replyTo.trim() : null
  const body = typeof input.body === 'string' ? input.body.trim() : ''

  if (!body) throw new Error('body is required')
  if (!['direction', 'implementation', 'review', 'sync'].includes(kind)) throw new Error('invalid kind')
  if (!['user', 'claude', 'codex'].includes(speaker)) throw new Error('invalid speaker')

  const normalizedTarget = normalizeTarget(speaker, target)
  const routedSpeakers = isRoutedTarget(normalizedTarget) && kind !== 'sync' && !isSyncOrUpdate(kind, body)
    ? autoAckSpeakers(normalizedTarget, speaker)
    : []
  const message = appendMessage({
    speaker,
    kind,
    target,
    taskType,
    loopId,
    replyTo,
    body,
    status: routedSpeakers.length > 0 ? 'working' : status,
  })
  const acks = routedSpeakers.length > 0 ? appendAutoAcks(message) : []

  appendJsonLine(ROUTE_INGEST_LOG, {
    id: crypto.randomUUID(),
    source,
    messageId: message.id,
    speaker: message.speaker,
    target: message.target,
    taskType: message.taskType,
    createdAt: new Date().toISOString(),
  })

  return { message, acks }
}

function safeRouteFileName(file) {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${path.basename(file)}`
}

function moveRouteFile(file, targetDir) {
  const target = path.join(targetDir, safeRouteFileName(file))
  fs.renameSync(file, target)
  return target
}

function ingestRouteFile(file) {
  if (!file.endsWith('.json')) return null
  const filePath = path.join(ROUTE_INBOX_DIR, file)
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const input = JSON.parse(raw)
  const routed = routeMessage(input, `file:${file}`)
  moveRouteFile(filePath, ROUTE_PROCESSED_DIR)
  return routed
}

function scanRouteInbox() {
  ensureStore()
  const files = fs.readdirSync(ROUTE_INBOX_DIR).filter((file) => file.endsWith('.json')).sort()
  const routed = []
  for (const file of files) {
    const filePath = path.join(ROUTE_INBOX_DIR, file)
    try {
      const result = ingestRouteFile(file)
      if (result) routed.push(result)
    } catch (error) {
      appendJsonLine(ROUTE_INGEST_LOG, {
        id: crypto.randomUUID(),
        source: `file:${file}`,
        error: error.message,
        createdAt: new Date().toISOString(),
      })
      try {
        moveRouteFile(filePath, ROUTE_FAILED_DIR)
      } catch {
        // Keep the original file in inbox if it cannot be moved.
      }
    }
  }
  if (routed.length > 0) {
    scheduleBroadcast('file-route')
    broadcastEvent('message', { routed })
  }
  return routed
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return []
  const raw = fs.readFileSync(file, 'utf8').trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function readMessages() {
  ensureStore()
  return readJsonLines(LOG_FILE).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

function writeJsonLines(file, rows) {
  const data = rows.map((row) => JSON.stringify(row)).join('\n')
  fs.writeFileSync(file, data ? `${data}\n` : '', 'utf8')
}

function updateMessageStatus(id, status) {
  const rows = readJsonLines(LOG_FILE)
  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return false
  rows[index].status = normalizeStatus(rows[index].speaker, status, rows[index].target || 'room')
  writeJsonLines(LOG_FILE, rows)
  scheduleBroadcast('status')
  return true
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

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function currentPcSnapshot(reason) {
  const targets = statusSnapshot()
  const previous = readJsonLines(SYNC_STATE_FILE).at(-1) || null
  const current = {
    id: crypto.randomUUID(),
    reason,
    createdAt: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: os.platform(),
    projectRoot: __dirname,
    gitBranch: gitValue(['branch', '--show-current']),
    gitCommit: gitValue(['rev-parse', '--short', 'HEAD']),
    gitStatus: gitValue(['status', '--short']) || '',
    targetsOk: targets.filter((target) => target.exists).length,
    targetsTotal: targets.length,
    previous: previous ? {
      hostname: previous.hostname,
      username: previous.username,
      createdAt: previous.createdAt,
      gitCommit: previous.gitCommit,
    } : null,
  }
  appendJsonLine(SYNC_STATE_FILE, current)
  return current
}

function syncSummary(snapshot) {
  const pc = `${snapshot.hostname}/${snapshot.username}`
  const previous = snapshot.previous
    ? `이전 기록: ${snapshot.previous.hostname}/${snapshot.previous.username} (${snapshot.previous.gitCommit || 'no-git'})`
    : '이전 기록 없음'
  const dirty = snapshot.gitStatus ? '로컬 변경 있음' : '로컬 변경 없음'
  return `동기화 스냅샷 기록: ${pc}, 기준 파일 ${snapshot.targetsOk}/${snapshot.targetsTotal} 확인, ${dirty}, 현재 커밋 ${snapshot.gitCommit || 'unknown'}. ${previous}.`
}

function safePayload() {
  const loops = loopSummaries()
    .filter((loop) => loop.status === 'open')
    .slice(0, 12)
    .map(({ messages, ...loop }) => loop)
  return {
    messages: readMessages(),
    loops,
    syncTargets: statusSnapshot(),
    storage: 'JH-SHARED / 01_AGENT_ROOM / agent-room-messages.jsonl',
    syncState: 'JH-SHARED / 03_LOGS / sync-state.jsonl',
    harnessDashboardUrl: HARNESS_DASHBOARD_URL,
    autoAckEnabled: AUTO_ACK_ENABLED,
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
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache, must-revalidate',
    })
    res.end(data)
  })
}

function isSyncOrUpdate(kind, body) {
  return kind === 'sync' || body.includes('동기화') || body.includes('업데이트') || body.toLowerCase().includes('update')
}

async function handleMessagePost(req, res) {
  try {
    const input = JSON.parse(await readBody(req))
    const speaker = input.speaker || 'user'
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    const kind = input.kind || 'direction'

    if (!body) return sendJson(res, 400, { error: 'body is required' })
    if (!['direction', 'implementation', 'review', 'sync'].includes(kind)) return sendJson(res, 400, { error: 'invalid kind' })
    if (!['user', 'claude', 'codex'].includes(speaker)) return sendJson(res, 400, { error: 'invalid speaker' })

    if (speaker !== 'user') {
      const secret = req.headers['x-admin-secret']
      if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        return sendJson(res, 401, { error: 'Unauthorized' })
      }
    }

    const { message, acks } = routeMessage(input, 'api')

    if (isSyncOrUpdate(kind, body)) {
      const snapshot = currentPcSnapshot(kind === 'sync' ? 'sync' : 'update')
      appendMessage({ speaker: 'claude', kind: 'implementation', body: '동기화 요청 접수. 전역 지침 전체가 아니라 JH-SHARED/00_SYSTEM의 최소 기준 파일부터 확인합니다.' })
      appendMessage({ speaker: 'codex', kind: 'review', body: syncSummary(snapshot) })
    }

    scheduleBroadcast('message')
    broadcastEvent('message', { message, acks })
    sendJson(res, 201, safePayload())
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid request' })
  }
}

function queueTargetsFor(agent) {
  if (agent === 'claude') return ['both', 'claude', 'harness']
  if (agent === 'codex') return ['both', 'codex', 'github', 'local']
  if (agent === 'gpt') return ['gpt']
  if (allowedTargets.includes(agent) && agent !== 'all') return [agent]
  return allowedTargets
}

function pendingQueue(agent) {
  const targets = new Set(queueTargetsFor(agent))
  return readMessages().filter((message) => {
    if (agent === 'claude' && message.speaker === 'claude') return false
    if (agent === 'codex' && message.speaker === 'codex') return false
    if ((message.status || 'todo') === 'done') return false
    return targets.has(message.target || 'room')
  })
}

function isAutoAckMessage(message) {
  return Boolean(message.autoAck) || (typeof message.body === 'string' && message.body.startsWith('[Agent Room 자동 접수]'))
}

function isOpenMessage(message) {
  return (message.status || 'todo') !== 'done' && message.status !== 'logged'
}

function loopSummaries() {
  const loops = new Map()
  for (const message of readMessages()) {
    const autoAck = isAutoAckMessage(message)
    const loopId = message.loopId || message.id
    if (!loops.has(loopId)) {
      loops.set(loopId, {
        id: loopId,
        firstMessageId: message.id,
        title: '',
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
        messages: [],
        speakers: new Set(),
        targets: new Set(),
        openCount: 0,
        actionOpenCount: 0,
        actionCount: 0,
        autoAckCount: 0,
        status: 'done',
      })
    }
    const loop = loops.get(loopId)
    loop.messages.push(message)
    if (new Date(message.createdAt) > new Date(loop.updatedAt)) loop.updatedAt = message.createdAt
    if (autoAck) {
      loop.autoAckCount += 1
    } else {
      loop.actionCount += 1
      loop.speakers.add(message.speaker)
      loop.targets.add(message.target || 'room')
      if (!loop.title) loop.title = message.body.split(/\r?\n/)[0].slice(0, 120)
      loop.lastActionMessage = message
    }
    if (isOpenMessage(message)) {
      loop.openCount += 1
      if (!autoAck) {
        loop.actionOpenCount += 1
        loop.status = 'open'
      }
    }
  }

  return Array.from(loops.values())
    .filter((loop) => loop.actionCount > 0)
    .map((loop) => ({
      ...loop,
      title: loop.title || '피드백 루프',
      speakers: Array.from(loop.speakers),
      targets: Array.from(loop.targets),
      messageCount: loop.messages.length,
      lastMessage: loop.messages.at(-1),
      lastActionMessage: loop.lastActionMessage || loop.messages.at(-1),
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

function handleLoopsGet(url, res) {
  const status = url.searchParams.get('status') || 'all'
  if (!['all', 'open', 'done'].includes(status)) {
    return sendJson(res, 400, { error: 'invalid status' })
  }
  const loops = loopSummaries().filter((loop) => status === 'all' || loop.status === status)
  sendJson(res, 200, {
    status,
    loops,
    generatedAt: new Date().toISOString(),
  })
}

function handleQueueGet(url, res) {
  const target = url.searchParams.get('target') || 'all'
  if (!['all', 'claude', 'codex', 'gpt', ...allowedTargets].includes(target)) {
    return sendJson(res, 400, { error: 'invalid target' })
  }
  sendJson(res, 200, {
    target,
    messages: pendingQueue(target),
    generatedAt: new Date().toISOString(),
  })
}

function handleInboxGet(_url, res) {
  ensureStore()
  sendJson(res, 200, {
    inbox: 'JH-SHARED / 01_AGENT_ROOM / inbox',
    processed: 'JH-SHARED / 01_AGENT_ROOM / processed',
    failed: 'JH-SHARED / 01_AGENT_ROOM / failed',
    pendingFiles: fs.readdirSync(ROUTE_INBOX_DIR).filter((file) => file.endsWith('.json')).sort(),
    generatedAt: new Date().toISOString(),
  })
}

function handleInboxScan(_url, res) {
  const routed = scanRouteInbox()
  sendJson(res, 200, {
    routedCount: routed.length,
    generatedAt: new Date().toISOString(),
  })
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')
  eventClients.add(res)
  writeEvent(res, 'payload', { reason: 'connected', ...safePayload() })

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
      eventClients.delete(res)
    }
  }, 25_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    eventClients.delete(res)
  })
}

async function handleStatusPost(req, res) {
  try {
    const input = JSON.parse(await readBody(req))
    const id = typeof input.id === 'string' ? input.id.trim() : ''
    const status = typeof input.status === 'string' ? input.status.trim() : ''

    if (!id) return sendJson(res, 400, { error: 'id is required' })
    if (!['todo', 'working', 'review', 'blocked', 'done'].includes(status)) return sendJson(res, 400, { error: 'invalid status' })
    if (!updateMessageStatus(id, status)) return sendJson(res, 404, { error: 'message not found' })

    sendJson(res, 200, safePayload())
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid request' })
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/messages' && req.method === 'GET') return sendJson(res, 200, safePayload())
  if (url.pathname === '/api/messages' && req.method === 'POST') return void handleMessagePost(req, res)
  if (url.pathname === '/api/messages/status' && req.method === 'POST') return void handleStatusPost(req, res)
  if (url.pathname === '/api/status' && req.method === 'GET') return sendJson(res, 200, safePayload())
  if (url.pathname === '/api/queue' && req.method === 'GET') return handleQueueGet(url, res)
  if (url.pathname === '/api/loops' && req.method === 'GET') return handleLoopsGet(url, res)
  if (url.pathname === '/api/inbox' && req.method === 'GET') return handleInboxGet(url, res)
  if (url.pathname === '/api/inbox/scan' && req.method === 'POST') return handleInboxScan(url, res)
  if (url.pathname === '/api/events' && req.method === 'GET') return handleEvents(req, res)

  const filePath = url.pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.normalize(path.join(PUBLIC_DIR, url.pathname))
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  sendFile(res, filePath)
})

ensureStore()
scanRouteInbox()
fs.watchFile(LOG_FILE, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) scheduleBroadcast('file')
})
fs.watch(ROUTE_INBOX_DIR, { persistent: false }, () => {
  setTimeout(() => {
    try {
      scanRouteInbox()
    } catch {
      // The next explicit scan or file event will retry.
    }
  }, 150)
})
server.listen(PORT, () => {
  console.log(`JH Agent Room running at http://localhost:${PORT}`)
})
