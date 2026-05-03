const baseUrlEl = document.querySelector('#base-url')
const targetEl = document.querySelector('#target')
const taskTypeEl = document.querySelector('#task-type')
const loopSelectEl = document.querySelector('#loop-select')
const loopIdEl = document.querySelector('#loop-id')
const replyToEl = document.querySelector('#reply-to')
const memoEl = document.querySelector('#memo')
const pageHostEl = document.querySelector('#page-host')
const pageTitleEl = document.querySelector('#page-title')
const pageUrlEl = document.querySelector('#page-url')
const selectionPreviewEl = document.querySelector('#selection-preview')
const statusEl = document.querySelector('#status')
const connectionStateEl = document.querySelector('#connection-state')
const sendEl = document.querySelector('#send')
const openRoomEl = document.querySelector('#open-room')
const checkConnectionEl = document.querySelector('#check-connection')
const copyJsonEl = document.querySelector('#copy-json')
const downloadJsonEl = document.querySelector('#download-json')

const defaultState = {
  baseUrl: 'http://127.0.0.1:3100',
  target: 'both',
  taskType: 'browser',
}

let activePage = {
  title: '',
  url: '',
  selection: '',
}

function setStatus(message, kind = '') {
  statusEl.className = kind
  statusEl.textContent = message
}

function setConnectionState(kind, text) {
  connectionStateEl.className = `state is-${kind}`
  connectionStateEl.textContent = text
}

function normalizeBaseUrl(value) {
  return (value || defaultState.baseUrl).trim().replace(/\/+$/, '')
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : ''
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(defaultState)
  baseUrlEl.value = stored.baseUrl || defaultState.baseUrl
  targetEl.value = stored.target || defaultState.target
  taskTypeEl.value = stored.taskType || defaultState.taskType
}

async function saveSettings() {
  await chrome.storage.local.set({
    baseUrl: normalizeBaseUrl(baseUrlEl.value),
    target: targetEl.value,
    taskType: taskTypeEl.value,
  })
}

async function getActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) throw new Error('Current tab was not found.')

  let selection = ''
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    })
    selection = result?.result || ''
  } catch {
    selection = ''
  }

  return {
    title: tab.title || '',
    url: tab.url || '',
    selection: selection.trim(),
  }
}

function renderPageInfo(page) {
  try {
    pageHostEl.textContent = page.url ? new URL(page.url).hostname : 'Current page'
  } catch {
    pageHostEl.textContent = 'Current page'
  }
  pageTitleEl.textContent = page.title || 'No title'
  pageUrlEl.textContent = page.url || ''
  selectionPreviewEl.textContent = page.selection ? `Selected text: ${page.selection}` : 'No selected text'
}

function buildBody() {
  const parts = [
    memoEl.value.trim(),
    '',
    '---',
    `Page title: ${activePage.title || 'No title'}`,
    `Page URL: ${activePage.url || 'No URL'}`,
  ]
  if (activePage.selection) {
    parts.push('', 'Selected text:', activePage.selection)
  }
  return parts.filter((part, index) => part || index !== 0).join('\n').trim()
}

function buildPayload() {
  const payload = {
    speaker: 'user',
    kind: 'direction',
    target: targetEl.value,
    taskType: taskTypeEl.value,
    body: buildBody(),
  }
  if (loopIdEl.value.trim()) payload.loopId = loopIdEl.value.trim()
  if (replyToEl.value.trim()) payload.replyTo = replyToEl.value.trim()
  return payload
}

async function checkConnection() {
  setConnectionState('checking', 'Checking')
  const response = await fetch(`${normalizeBaseUrl(baseUrlEl.value)}/api/status`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Agent Room returned an error.')
  const payload = await response.json()
  setConnectionState('connected', 'Connected')
  return payload
}

function renderLoops(loops = []) {
  const previous = loopSelectEl.value
  loopSelectEl.innerHTML = '<option value="">Share as new loop</option>'
  for (const loop of loops.filter((item) => item.status === 'open').slice(0, 20)) {
    const option = document.createElement('option')
    option.value = loop.id
    option.dataset.replyTo = loop.lastActionMessage?.id || loop.lastMessage?.id || ''
    option.textContent = `${shortId(loop.id)} - ${loop.title || 'Feedback loop'}`
    loopSelectEl.appendChild(option)
  }
  if ([...loopSelectEl.options].some((option) => option.value === previous)) {
    loopSelectEl.value = previous
  }
}

async function refreshConnectionAndLoops() {
  try {
    const payload = await checkConnection()
    renderLoops(payload.loops || [])
    setStatus('Agent Room connection checked.', 'ok')
  } catch (error) {
    setConnectionState('offline', 'Offline')
    setStatus(`${error.message} Use Copy JSON or Save JSON as fallback.`, 'error')
  }
}

async function sendToAgentRoom() {
  await saveSettings()
  const payload = buildPayload()
  if (!payload.body) throw new Error('Nothing to share.')

  const response = await fetch(`${normalizeBaseUrl(baseUrlEl.value)}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Agent Room share failed.')
  setConnectionState('connected', 'Connected')
  return data
}

async function copyJson() {
  const payload = buildPayload()
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
}

function downloadJson() {
  const payload = buildPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const link = document.createElement('a')
  link.href = url
  link.download = `agent-room-share-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function openAgentRoom() {
  chrome.tabs.create({ url: normalizeBaseUrl(baseUrlEl.value) })
}

sendEl.addEventListener('click', async () => {
  try {
    setStatus('Sharing...')
    const payload = await sendToAgentRoom()
    renderLoops(payload.loops || [])
    setStatus('Shared to Agent Room.', 'ok')
  } catch (error) {
    setConnectionState('offline', 'Offline')
    setStatus(`${error.message} Use Copy JSON or Save JSON as fallback.`, 'error')
  }
})

openRoomEl.addEventListener('click', openAgentRoom)
checkConnectionEl.addEventListener('click', refreshConnectionAndLoops)

copyJsonEl.addEventListener('click', async () => {
  try {
    await copyJson()
    setStatus('JSON copied.', 'ok')
  } catch (error) {
    setStatus(error.message, 'error')
  }
})

downloadJsonEl.addEventListener('click', () => {
  try {
    downloadJson()
    setStatus('JSON saved.', 'ok')
  } catch (error) {
    setStatus(error.message, 'error')
  }
})

loopSelectEl.addEventListener('change', () => {
  const selected = loopSelectEl.selectedOptions[0]
  loopIdEl.value = selected?.value || ''
  replyToEl.value = selected?.dataset.replyTo || ''
})

for (const el of [baseUrlEl, targetEl, taskTypeEl]) {
  el.addEventListener('change', () => saveSettings().catch(() => {}))
}

baseUrlEl.addEventListener('change', refreshConnectionAndLoops)

loadSettings()
  .then(getActivePage)
  .then((page) => {
    activePage = page
    renderPageInfo(page)
    setStatus('Ready to share.')
    return refreshConnectionAndLoops()
  })
  .catch((error) => {
    setConnectionState('offline', 'Offline')
    setStatus(error.message, 'error')
  })
