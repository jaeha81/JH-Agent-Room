const messagesEl = document.querySelector('#messages')
const targetsEl = document.querySelector('#targets')
const form = document.querySelector('#message-form')
const kindEl = document.querySelector('#kind')
const bodyEl = document.querySelector('#body')
const errorEl = document.querySelector('#error')
const refreshEl = document.querySelector('#refresh')
const quickSyncEl = document.querySelector('#quick-sync')
const exportLogEl = document.querySelector('#export-log')
const autoRefreshEl = document.querySelector('#auto-refresh')
const storageEl = document.querySelector('#storage')
const agentEnabledEl = document.querySelector('#agent-enabled')
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'))

const labels = {
  user: '사용자',
  claude: 'Claude',
  codex: 'Codex',
  direction: '지시',
  implementation: '구현',
  review: '검수',
  sync: '동기화',
}

let currentMessages = []
let currentFilter = 'all'
let refreshTimer = null

function formatTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function setError(message) {
  errorEl.hidden = !message
  errorEl.textContent = message || ''
}

function visibleMessages() {
  if (currentFilter === 'all') return currentMessages
  return currentMessages.filter((message) => message.speaker === currentFilter)
}

function renderMessages(messages) {
  currentMessages = messages
  messagesEl.innerHTML = ''
  const counts = { user: 0, claude: 0, codex: 0 }

  for (const message of messages) {
    counts[message.speaker] += 1
  }

  for (const message of visibleMessages()) {
    const item = document.createElement('article')
    item.className = `message ${message.speaker}`
    item.innerHTML = `
      <div class="message-head">
        <span><span class="badge">${labels[message.speaker]}</span> · ${labels[message.kind]}</span>
        <time>${formatTime(message.createdAt)}</time>
      </div>
      <p></p>
    `
    item.querySelector('p').textContent = message.body
    messagesEl.appendChild(item)
  }

  if (visibleMessages().length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.textContent = '표시할 메시지가 없습니다.'
    messagesEl.appendChild(empty)
  }

  document.querySelector('#count-user').textContent = counts.user
  document.querySelector('#count-claude').textContent = counts.claude
  document.querySelector('#count-codex').textContent = counts.codex
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function renderTargets(targets) {
  targetsEl.innerHTML = ''
  for (const target of targets) {
    const item = document.createElement('div')
    item.className = `target ${target.exists ? 'ok' : 'missing'}`
    item.innerHTML = `
      <div>
        <strong>${target.label}</strong>
        <p>${target.updatedAt ? new Date(target.updatedAt).toLocaleString('ko-KR') : '확인되지 않음'}</p>
      </div>
      <span class="state">${target.exists ? '확인' : '없음'}</span>
    `
    targetsEl.appendChild(item)
  }
}

function renderPayload(payload) {
  renderMessages(payload.messages)
  renderTargets(payload.syncTargets)
  storageEl.textContent = `저장소: ${payload.storage}`
  agentEnabledEl.textContent = payload.agentPostingEnabled ? 'Claude/Codex 등록: 활성화됨' : 'Claude/Codex 등록: .env의 ADMIN_SECRET 필요'
}

async function loadRoom() {
  setError('')
  const response = await fetch('/api/messages', { cache: 'no-store' })
  if (!response.ok) throw new Error('채팅방 데이터를 불러오지 못했습니다.')
  renderPayload(await response.json())
}

async function postUserMessage(kind, body) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speaker: 'user', kind, body }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || '메시지를 저장하지 못했습니다.')
  renderPayload(payload)
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  if (autoRefreshEl.checked) {
    refreshTimer = setInterval(() => {
      loadRoom().catch((error) => setError(error.message))
    }, 5000)
  }
}

function exportLog() {
  const blob = new Blob([JSON.stringify(currentMessages, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  link.href = url
  link.download = `jh-agent-room-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const body = bodyEl.value.trim()
  if (!body) return

  try {
    setError('')
    await postUserMessage(kindEl.value, body)
    bodyEl.value = ''
  } catch (error) {
    setError(error.message)
  }
})

refreshEl.addEventListener('click', () => {
  loadRoom().catch((error) => setError(error.message))
})

quickSyncEl.addEventListener('click', () => {
  postUserMessage('sync', '동기화').catch((error) => setError(error.message))
})

exportLogEl.addEventListener('click', exportLog)
autoRefreshEl.addEventListener('change', scheduleAutoRefresh)

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter
    for (const item of filterButtons) item.classList.toggle('active', item === button)
    renderMessages(currentMessages)
  })
}

loadRoom().then(scheduleAutoRefresh).catch((error) => setError(error.message))
