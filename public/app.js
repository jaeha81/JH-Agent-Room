const messagesEl = document.querySelector('#messages')
const targetsEl = document.querySelector('#targets')
const form = document.querySelector('#message-form')
const kindEl = document.querySelector('#kind')
const taskTypeEl = document.querySelector('#task-type')
const bodyEl = document.querySelector('#body')
const errorEl = document.querySelector('#error')
const refreshEl = document.querySelector('#refresh')
const quickSyncEl = document.querySelector('#quick-sync')
const quickUpdateEl = document.querySelector('#quick-update')
const exportLogEl = document.querySelector('#export-log')
const autoRefreshEl = document.querySelector('#auto-refresh')
const storageEl = document.querySelector('#storage')
const syncStateEl = document.querySelector('#sync-state')
const realtimeStateEl = document.querySelector('#realtime-state')
const agentEnabledEl = document.querySelector('#agent-enabled')
const harnessDashboardLinkEl = document.querySelector('#harness-dashboard-link')
const searchEl = document.querySelector('#search')
const detailEl = document.querySelector('#detail')
const recentRoutingEl = document.querySelector('#recent-routing')
const recentRoutingTitleEl = document.querySelector('#recent-routing-title')
const targetSummaryEl = document.querySelector('#target-summary')
const targetOpenLinkEl = document.querySelector('#target-open-link')
const statusSummaryEl = document.querySelector('#status-summary')
const queueRoomEl = document.querySelector('#queue-room')
const queueBothEl = document.querySelector('#queue-both')
const queueGptEl = document.querySelector('#queue-gpt')
const queueClaudeEl = document.querySelector('#queue-claude')
const queueCodexEl = document.querySelector('#queue-codex')
const queueHarnessEl = document.querySelector('#queue-harness')
const queueGithubEl = document.querySelector('#queue-github')
const queueLocalEl = document.querySelector('#queue-local')
const queueCountRoomEl = document.querySelector('#queue-count-room')
const queueCountBothEl = document.querySelector('#queue-count-both')
const queueCountGptEl = document.querySelector('#queue-count-gpt')
const queueCountClaudeEl = document.querySelector('#queue-count-claude')
const queueCountCodexEl = document.querySelector('#queue-count-codex')
const queueCountHarnessEl = document.querySelector('#queue-count-harness')
const queueCountGithubEl = document.querySelector('#queue-count-github')
const queueCountLocalEl = document.querySelector('#queue-count-local')
const loopListEl = document.querySelector('#loop-list')
const loopCountEl = document.querySelector('#loop-count')
const opsMetricEls = {
  todo: document.querySelector('[data-metric="todo"]'),
  working: document.querySelector('[data-metric="working"]'),
  review: document.querySelector('[data-metric="review"]'),
  blocked: document.querySelector('[data-metric="blocked"]'),
  done: document.querySelector('[data-metric="done"]'),
}
const targetButtons = Array.from(document.querySelectorAll('[data-target]'))
const templateButtons = Array.from(document.querySelectorAll('[data-template]'))
const statusButtons = Array.from(document.querySelectorAll('[data-status]'))
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'))
const workViewButtons = Array.from(document.querySelectorAll('[data-work-view]'))
const quickTargetButtons = Array.from(document.querySelectorAll('[data-quick-target]'))
const focusComposeEl = document.querySelector('#focus-compose')
const toggleToolsEl = document.querySelector('#toggle-tools')
const toggleOpsEl = document.querySelector('#toggle-ops')

const labels = {
  user: '사용자',
  claude: 'Claude',
  codex: 'Codex',
  direction: '공유',
  implementation: '구현',
  review: '검수',
  notice: '공지',
  sync: '동기화',
  room: '공유',
  both: 'Claude+Codex 공동 루프',
  gpt: 'GPT 계획',
  harness: 'Harness 착수',
  github: 'Codex: GitHub 확인',
  local: 'Codex: 로컬 작업',
  question: '새 질문',
  plan: '개발 계획',
  browser: '브라우저/확장',
}

const statusLabels = {
  todo: '대기',
  working: '진행중',
  review: '검수중',
  blocked: '막힘',
  done: '완료',
}

let currentMessages = []
let currentFilter = 'all'
let currentWorkView = 'yesterday'
let refreshTimer = null
let activeMessageId = null
let currentTarget = 'both'
let eventSource = null
let realtimeConnected = false
let payloadInitialized = false
let knownMessageIds = new Set()
let highlightedMessageIds = new Set()
let latestRoutedMessageId = null
let pendingLoopLink = null

const quickStatuses = ['todo', 'working', 'blocked', 'done']

const templates = {
  'gpt-plan': {
    target: 'gpt',
    taskType: 'plan',
    kind: 'direction',
    body: '목표:\n현재 상황:\n제약 조건:\n원하는 산출물: Claude에게 전달할 구현 프롬프트와 단계별 계획\n검토 기준:',
  },
  'claude-start': {
    target: 'claude',
    taskType: 'implementation',
    kind: 'direction',
    body: 'Claude 작업 공유:\n역할: 플랜 / 구현 / 운영 정리 / Codex 이관 중 선택\n작업 목적:\n대상 저장소/폴더:\n수정 예정 파일:\n기대 결과:\n작업 시작 전 잠금 확인:\nCodex 교차 확인이 필요한 지점:\n작업 후 Agent Room에 남길 내용:',
  },
  'codex-review': {
    target: 'codex',
    taskType: 'review',
    kind: 'review',
    body: 'Codex 작업 공유:\n역할: 분석 / 구현 / 검수 / Claude 이관 중 선택\n작업 목적:\n대상 저장소/폴더:\n확인 또는 수정할 파일:\n검증 기준:\nClaude에게 이관할 자료:\n사용자 승인 필요 항목:\nAgent Room에 남길 결과:',
  },
  'harness-start': {
    target: 'harness',
    taskType: 'harness',
    kind: 'direction',
    body: 'Harness 착수 분석 요청:\n개발 제목:\n개발 목적:\n관련 자료/지침:\n필요 플래그: 테스트 / 장기작업 / UX / 보안\n원하는 산출물: Claude Code 프롬프트, Codex 체크리스트, LLM Wiki entry',
  },
  'harness-sync': {
    target: 'harness',
    taskType: 'harness',
    kind: 'direction',
    body: 'Harness 연동 점검 요청:\n확인 대상: Agent Room -> JH Harness 대시보드 연결\n확인할 내용: 하네스 대시보드 URL, 착수 템플릿, Claude 구현 큐 편입, Codex 검수 루프\n결과 공유: 같은 피드백 루프에 남기기',
  },
  'github-status': {
    target: 'github',
    taskType: 'github',
    kind: 'direction',
    body: 'Codex용 GitHub 상태 확인:\n대상 저장소:\n확인할 브랜치/PR/커밋:\n필요한 결과: 현재 상태, 미반영 변경, 위험 파일, 다음 조치',
  },
  'local-task': {
    target: 'local',
    taskType: 'local',
    kind: 'direction',
    body: 'Codex용 로컬 작업 요청:\n대상 경로:\n수행할 작업:\n확인할 결과:\n주의할 파일/삭제 금지 항목:',
  },
  'shared-plan': {
    target: 'both',
    taskType: 'question',
    kind: 'direction',
    body: '공동 루프 요청:\n사용자 질문/작업:\nClaude 관점: 플랜/구현/운영\nCodex 관점: 분석/구현/검수\n상호 이관할 자료:\n최종 답변 형식:',
  },
}

const targetPresets = {
  room: {
    taskType: 'question',
    placeholder: '공유 메모 또는 운영 내용을 입력하세요',
    summary: '공유 기록으로 남기고 Agent Room 전체 맥락에 반영합니다.',
  },
  both: {
    taskType: 'question',
    placeholder: 'Claude와 Codex가 같은 루프에서 함께 다룰 질문, 작업, 이관 자료를 공유하세요',
    summary: 'Claude와 Codex가 각자 작업자 또는 검증자가 되어 상호 검토합니다.',
  },
  gpt: {
    taskType: 'plan',
    placeholder: 'GPT로 정리할 개발 계획, 명령 프롬프트, 요구사항을 입력하세요',
    summary: '계획 수립과 Claude 전달용 프롬프트 작성에 맞춘 공유입니다.',
  },
  claude: {
    taskType: 'implementation',
    placeholder: 'Claude가 플랜·구현·운영 정리할 저장소, 파일, 기대 결과를 입력하세요',
    summary: 'Claude 작업 큐에 올라갑니다. 필요 시 Codex 교차 확인으로 넘길 수 있습니다.',
  },
  codex: {
    taskType: 'review',
    placeholder: 'Codex가 분석·구현·검수할 파일, 커밋, 이관 자료를 입력하세요',
    summary: 'Codex 작업 큐에 올라갑니다. 사용자 지시가 있으면 개발/구현도 진행하고 Claude에 이관할 수 있습니다.',
  },
  harness: {
    taskType: 'harness',
    placeholder: 'Harness로 분석할 개발 목적, 자료, GPT/Claude 지침, 원하는 산출물을 입력하세요',
    summary: '작업 큐로 분류하고, 필요하면 아래 링크로 JH Harness 대시보드에서 개발 착수 분석을 진행합니다.',
    dashboardUrl: 'http://127.0.0.1:3200',
  },
  github: {
    taskType: 'github',
    placeholder: 'Codex가 확인할 저장소, 브랜치, PR, 커밋, CI 상태를 입력하세요',
    summary: 'Codex가 저장소/브랜치/커밋/PR/CI 상태를 확인할 작업으로 분류합니다.',
  },
  local: {
    taskType: 'local',
    placeholder: 'Codex가 현재 PC에서 확인하거나 실행할 경로, 명령, 기대 결과를 입력하세요',
    summary: 'Codex가 현재 PC의 파일/서버/포트/브라우저 작업을 수행할 작업으로 분류합니다.',
  },
}

function formatTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '시간 미확인'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function setError(message) {
  errorEl.hidden = !message
  errorEl.textContent = message || ''
}

function setRealtimeState(state, text) {
  if (!realtimeStateEl) return
  realtimeStateEl.className = `realtime-state is-${state}`
  realtimeStateEl.textContent = `실시간 감지: ${text}`
}

function updateTargetUI() {
  for (const button of targetButtons) {
    button.classList.toggle('active', button.dataset.target === currentTarget)
  }
  for (const button of quickTargetButtons) {
    button.classList.toggle('active', button.dataset.quickTarget === currentTarget)
  }
  const preset = targetPresets[currentTarget]
  if (preset && taskTypeEl.value !== preset.taskType) {
    taskTypeEl.value = preset.taskType
  }
  if (preset) {
    bodyEl.placeholder = preset.placeholder
  }
  if (targetOpenLinkEl) {
    const dashboardUrl = preset && preset.dashboardUrl
    targetOpenLinkEl.hidden = !dashboardUrl
    if (dashboardUrl) {
      targetOpenLinkEl.href = dashboardUrl
      targetOpenLinkEl.textContent = `${labels[currentTarget]} 대시보드 열기`
    }
  }
  targetSummaryEl.textContent = `현재 공유 대상: ${labels[currentTarget]} · ${preset ? preset.summary : '선택한 대상으로 공유 내용을 라우팅합니다.'}`
}

function taskTypeLabel(message) {
  return labels[message.taskType || 'question'] || labels.question
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : ''
}

function isAutoAckClient(message) {
  return Boolean(message.autoAck) || (typeof message.body === 'string' && message.body.startsWith('[Agent Room'))
}

function responseMessagesFor(loopId) {
  return currentMessages.filter((message) => {
    if (!loopId) return false
    if (message.speaker === 'user') return false
    if (isAutoAckClient(message)) return false
    return (message.loopId || message.id) === loopId || message.replyTo === loopId
  })
}

function updateStatusUI(message) {
  const activeStatus = message && message.status !== 'logged' ? (message.status || 'todo') : null
  for (const button of statusButtons) {
    button.classList.toggle('active', button.dataset.status === activeStatus)
    button.disabled = !activeStatus
  }
  statusSummaryEl.textContent = activeStatus
    ? `현재 상태: ${statusLabels[activeStatus]}`
    : '큐 메시지를 선택하면 상태를 변경할 수 있습니다.'
}

function workViewMatches(message) {
  if (currentWorkView === 'yesterday') return isYesterday(message.createdAt)
  if (currentWorkView === 'all') return true
  if (currentWorkView === 'blocked') return message.status === 'blocked'
  if (currentWorkView === 'claude') return ['both', 'claude', 'harness'].includes(message.target || 'room') && message.speaker !== 'claude'
  if (currentWorkView === 'codex') return ['both', 'codex', 'github', 'local'].includes(message.target || 'room') && message.speaker !== 'codex'
  return true
}

function isYesterday(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()
}

function messageTitle(message) {
  return (message.body || '').split('\n').find(Boolean)?.slice(0, 90) || '새 공유'
}

function trackIncomingMessages(messages) {
  const nextIds = new Set(messages.map((message) => message.id))
  if (!payloadInitialized) {
    knownMessageIds = nextIds
    payloadInitialized = true
    return
  }

  const incoming = messages.filter((message) => !knownMessageIds.has(message.id))
  knownMessageIds = nextIds
  if (incoming.length === 0) return

  for (const message of incoming) {
    highlightedMessageIds.add(message.id)
  }
  highlightedMessageIds = new Set([...highlightedMessageIds].slice(-20))

  const latestAction = [...incoming].reverse().find((message) => !message.body?.startsWith('[Agent Room 자동 접수]')) || incoming.at(-1)
  latestRoutedMessageId = latestAction.id
  activeMessageId = latestAction.id
  currentFilter = 'all'
  for (const button of filterButtons) button.classList.toggle('active', button.dataset.filter === 'all')
}

function renderRecentRouting() {
  if (!recentRoutingEl || !recentRoutingTitleEl) return
  const message = currentMessages.find((item) => item.id === latestRoutedMessageId)
  recentRoutingEl.hidden = !message
  if (!message) return
  recentRoutingTitleEl.textContent = `${labels[message.target || 'room'] || '공유'} · ${messageTitle(message)}`
}

function mountAnswerPanel() {
  if (document.querySelector('#answer-panel')) return
  const workspace = document.querySelector('.workspace')
  if (!workspace) return
  const panel = document.createElement('section')
  panel.id = 'answer-panel'
  panel.className = 'answer-panel'
  panel.setAttribute('aria-label', '최근 답변')
  panel.innerHTML = `
    <div class="answer-head">
      <div>
        <span>답변함</span>
        <h3>최근 답변</h3>
      </div>
      <button type="button" data-answer-view="all">전체 작업 보기</button>
    </div>
    <div id="answer-list" class="answer-list"></div>
  `
  workspace.insertAdjacentElement('beforebegin', panel)
  panel.querySelector('[data-answer-view="all"]').addEventListener('click', () => setWorkView('all'))
}

function renderAnswerPanel(messages) {
  const list = document.querySelector('#answer-list')
  if (!list) return
  const requests = messages
    .filter((message) => message.speaker === 'user')
    .slice(-5)
    .reverse()

  list.innerHTML = ''
  if (requests.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'answer-empty'
    empty.textContent = '아직 요청이 없습니다.'
    list.appendChild(empty)
    return
  }

  for (const request of requests) {
    const loopId = request.loopId || request.id
    const replies = responseMessagesFor(loopId)
    const latestReply = replies.at(-1)
    const item = document.createElement('button')
    item.type = 'button'
    item.className = `answer-item ${latestReply ? 'has-reply' : 'pending'}`
    item.innerHTML = `
      <span>${latestReply ? '답변 완료' : '답변 대기'}</span>
      <strong></strong>
      <small></small>
    `
    item.querySelector('strong').textContent = messageTitle(request)
    item.querySelector('small').textContent = latestReply
      ? `${labels[latestReply.speaker] || latestReply.speaker}: ${messageTitle(latestReply)}`
      : '자동 접수만 완료되었습니다. 실제 답변은 아직 없습니다.'
    item.addEventListener('click', () => {
      activeMessageId = latestReply ? latestReply.id : request.id
      setWorkView('all')
      selectMessage(latestReply || request)
      renderMessages(currentMessages)
    })
    list.appendChild(item)
  }
}

function prepareBlockedFeedback(message) {
  pendingLoopLink = {
    loopId: message.loopId || message.id,
    replyTo: message.id,
  }
  currentTarget = 'both'
  kindEl.value = 'direction'
  taskTypeEl.value = 'question'
  bodyEl.value = [
    '막힘 피드백 공유:',
    `원본 루프: ${shortId(pendingLoopLink.loopId)}`,
    `원본 메시지: ${shortId(message.id)}`,
    `대상: ${labels[message.target || 'room'] || message.target}`,
    `현재 상태: ${statusLabels.blocked}`,
    '',
    'Claude 확인:',
    '- 구현/운영 관점에서 막힌 원인과 다음 실행안을 공유',
    '',
    'Codex 확인:',
    '- 검증/리스크 관점에서 충돌, 누락, 회귀 가능성을 공유',
    '',
    '필요한 사용자 판단:',
    '- ',
  ].join('\n')
  updateTargetUI()
  bodyEl.focus()
  setError('막힘 상태가 표시되었습니다. 입력창에 Claude/Codex 피드백 공유 문구를 준비했습니다.')
}

function createStatusActions(message) {
  const row = document.createElement('div')
  row.className = 'message-status-row'
  const currentStatus = message.status || 'todo'

  for (const status of quickStatuses) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `mini-status ${currentStatus === status ? 'active' : ''}`
    button.textContent = statusLabels[status]
    button.disabled = message.status === 'logged'
    button.addEventListener('click', async (event) => {
      event.stopPropagation()
      try {
        setError('')
        await updateMessageStatus(message.id, status)
        if (status === 'blocked') prepareBlockedFeedback(message)
      } catch (error) {
        setError(error.message)
      }
    })
    row.appendChild(button)
  }

  return row
}

function visibleMessages() {
  const query = searchEl.value.trim().toLowerCase()
  return currentMessages.filter((message) => {
    const speakerMatches = currentFilter === 'all' || message.speaker === currentFilter
    if (!speakerMatches) return false
    if (!workViewMatches(message)) return false
    if (!query) return true
    return [
      labels[message.speaker],
      labels[message.kind],
      labels[message.target],
      taskTypeLabel(message),
      message.body,
      formatTimestamp(message.createdAt),
    ].join(' ').toLowerCase().includes(query)
  })
}

function selectMessage(message) {
  activeMessageId = message ? message.id : null
  if (!message) {
    detailEl.className = 'detail-card primary-detail empty'
    detailEl.innerHTML = '<strong>선택된 메시지 없음</strong><p>메시지를 선택하면 전체 작업 내용과 공유 대상을 확인할 수 있습니다.</p>'
    return
  }

  const targetLabel = labels[message.target || 'room'] || '채팅방 기록'
  const statusLabel = statusLabels[message.status || 'todo'] || '기록'
  const typeLabel = taskTypeLabel(message)
  detailEl.className = `detail-card primary-detail ${message.speaker}`
  detailEl.innerHTML = `
    <div class="detail-head">
      <span><span class="badge">${labels[message.speaker]}</span> · ${labels[message.kind]}</span>
      <time datetime="${message.createdAt}">${formatTimestamp(message.createdAt)}</time>
    </div>
    <p class="detail-target">작업 유형: ${typeLabel}</p>
    <p class="detail-target">대상: ${targetLabel}</p>
    <p class="detail-status">상태: ${statusLabel}</p>
    <p class="detail-target">루프: ${shortId(message.loopId || message.id)}${message.replyTo ? ` · 답장: ${shortId(message.replyTo)}` : ''}</p>
    <pre></pre>
  `
  detailEl.querySelector('pre').textContent = message.body
  updateStatusUI(message)
}

function renderOpsMetrics(messages) {
  const counts = { todo: 0, working: 0, review: 0, blocked: 0, done: 0 }
  for (const message of messages) {
    if (message.autoAck || message.status === 'logged') continue
    const status = message.status || 'todo'
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1
    }
  }
  for (const [status, count] of Object.entries(counts)) {
    if (opsMetricEls[status]) opsMetricEls[status].textContent = String(count)
  }
}

function renderMessages(messages) {
  currentMessages = messages
  messagesEl.innerHTML = ''
  const counts = { user: 0, claude: 0, codex: 0 }

  for (const message of messages) {
    counts[message.speaker] += 1
  }

  const shownMessages = visibleMessages()
  if (!activeMessageId && shownMessages.length > 0) {
    activeMessageId = shownMessages[shownMessages.length - 1].id
  }

  for (const message of shownMessages) {
    const item = document.createElement('article')
    item.className = [
      'message',
      message.speaker,
      message.id === activeMessageId ? 'active' : '',
      highlightedMessageIds.has(message.id) ? 'is-new' : '',
      message.status ? `status-${message.status}` : '',
    ].filter(Boolean).join(' ')
    item.tabIndex = 0
    const targetLabel = labels[message.target || 'room'] || labels[message.speaker]
    const statusLabel = statusLabels[message.status || 'todo'] || null
    const typeLabel = taskTypeLabel(message)
    item.innerHTML = `
      <div class="message-head">
        <span><span class="badge">${labels[message.speaker]}</span> · ${labels[message.kind]}</span>
        <time datetime="${message.createdAt}">${formatTimestamp(message.createdAt)}</time>
      </div>
      <div class="message-meta">${highlightedMessageIds.has(message.id) ? '<span class="new-badge">새 공유</span> · ' : ''}${typeLabel} · ${targetLabel}${statusLabel ? ` · ${statusLabel}` : ''}${message.loopId ? ` · loop ${shortId(message.loopId)}` : ''}</div>
      <p></p>
    `
    item.querySelector('p').textContent = message.body
    if (message.status !== 'logged') {
      item.appendChild(createStatusActions(message))
    }
    item.addEventListener('click', () => {
      selectMessage(message)
      renderMessages(currentMessages)
    })
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectMessage(message)
        renderMessages(currentMessages)
      }
    })
    messagesEl.appendChild(item)
  }

  const selectedMessage = currentMessages.find((message) => message.id === activeMessageId)
  selectMessage(selectedMessage || shownMessages.at(-1) || null)

  if (shownMessages.length === 0) {
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

function renderQueueList(container, countEl, messages) {
  container.innerHTML = ''
  countEl.textContent = String(messages.length)

  if (messages.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'queue-empty'
    empty.textContent = '대기 중인 공유 없음'
    container.appendChild(empty)
    return
  }

  for (const message of messages.slice(-4).reverse()) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = `queue-item${highlightedMessageIds.has(message.id) ? ' is-new' : ''}`
    item.innerHTML = `
      <span class="queue-time">${formatTimestamp(message.createdAt)} · ${taskTypeLabel(message)} · ${statusLabels[message.status || 'todo']}</span>
      <span class="queue-text"></span>
    `
    item.querySelector('.queue-text').textContent = message.body
    item.addEventListener('click', () => {
      activeMessageId = message.id
      currentFilter = 'all'
      currentWorkView = 'all'
      for (const button of filterButtons) button.classList.toggle('active', button.dataset.filter === 'all')
      for (const button of workViewButtons) button.classList.toggle('active', button.dataset.workView === 'all')
      selectMessage(message)
      renderMessages(currentMessages)
    })
    container.appendChild(item)
  }
}

function renderQueues(messages) {
  const routedMessages = messages.filter((message) => (message.status || 'todo') !== 'done' && message.status !== 'logged')
  renderQueueList(queueRoomEl, queueCountRoomEl, routedMessages.filter((message) => (message.target || 'room') === 'room'))
  renderQueueList(queueBothEl, queueCountBothEl, routedMessages.filter((message) => message.target === 'both'))
  renderQueueList(queueGptEl, queueCountGptEl, routedMessages.filter((message) => message.target === 'gpt'))
  renderQueueList(queueClaudeEl, queueCountClaudeEl, routedMessages.filter((message) => message.target === 'claude'))
  renderQueueList(queueCodexEl, queueCountCodexEl, routedMessages.filter((message) => message.target === 'codex'))
  renderQueueList(queueHarnessEl, queueCountHarnessEl, routedMessages.filter((message) => message.target === 'harness'))
  renderQueueList(queueGithubEl, queueCountGithubEl, routedMessages.filter((message) => message.target === 'github'))
  renderQueueList(queueLocalEl, queueCountLocalEl, routedMessages.filter((message) => message.target === 'local'))
}

function renderLoops(loops = []) {
  loopListEl.innerHTML = ''
  const openLoops = loops.filter((loop) => loop.status === 'open')
  loopCountEl.textContent = String(openLoops.length)

  if (openLoops.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'queue-empty'
    empty.textContent = '열린 피드백 루프 없음'
    loopListEl.appendChild(empty)
    return
  }

  for (const loop of openLoops.slice(0, 6)) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'loop-item'
    const speakers = (loop.speakers || []).map((speaker) => labels[speaker] || speaker).join(' + ')
    const targets = (loop.targets || []).map((target) => labels[target] || target).join(' / ')
    item.innerHTML = `
      <span class="loop-meta">${shortId(loop.id)} · 실제 ${loop.actionCount || loop.messageCount}개 · 열린 ${loop.actionOpenCount || 0}개${loop.autoAckCount ? ` · 접수 ${loop.autoAckCount}개` : ''}</span>
      <strong></strong>
      <span class="loop-route">${speakers} -> ${targets}</span>
    `
    item.querySelector('strong').textContent = loop.title || '피드백 루프'
    item.addEventListener('click', () => {
      const latestMessage = currentMessages.find((message) => message.id === loop.lastActionMessage?.id)
        || currentMessages.find((message) => message.id === loop.lastMessage?.id)
        || currentMessages.find((message) => message.loopId === loop.id)
      if (!latestMessage) return
      activeMessageId = latestMessage.id
      currentFilter = 'all'
      for (const button of filterButtons) button.classList.toggle('active', button.dataset.filter === 'all')
      selectMessage(latestMessage)
      renderMessages(currentMessages)
    })
    loopListEl.appendChild(item)
  }
}

function renderPayload(payload) {
  trackIncomingMessages(payload.messages)
  renderOpsMetrics(payload.messages)
  renderMessages(payload.messages)
  renderAnswerPanel(payload.messages)
  renderQueues(payload.messages)
  renderLoops(payload.loops || [])
  renderRecentRouting()
  renderTargets(payload.syncTargets)
  storageEl.textContent = `저장소: ${payload.storage}`
  syncStateEl.textContent = `동기화 기록: ${payload.syncState || 'JH-SHARED / 03_LOGS / sync-state.jsonl'}`
  if (harnessDashboardLinkEl && payload.harnessDashboardUrl) {
    harnessDashboardLinkEl.href = payload.harnessDashboardUrl
  }
  if (targetPresets.harness && payload.harnessDashboardUrl) {
    targetPresets.harness.dashboardUrl = payload.harnessDashboardUrl
    if (currentTarget === 'harness') updateTargetUI()
  }
  const autoAckState = payload.autoAckEnabled ? '자동 접수: 활성화' : '자동 접수: 비활성화'
  const postingState = payload.agentPostingEnabled ? 'Claude/Codex 등록: 활성화됨' : 'Claude/Codex 등록: .env의 ADMIN_SECRET 필요'
  agentEnabledEl.textContent = `${autoAckState} · ${postingState}`
}

async function loadRoom() {
  setError('')
  const response = await fetch('/api/messages', { cache: 'no-store' })
  if (!response.ok) throw new Error('채팅방 데이터를 불러오지 못했습니다.')
  renderPayload(await response.json())
}

function startEventStream() {
  if (!window.EventSource || eventSource) {
    if (!window.EventSource) setRealtimeState('polling', '폴링')
    return
  }

  setRealtimeState('reconnecting', '연결 중')
  eventSource = new EventSource('/api/events')

  eventSource.onopen = () => {
    realtimeConnected = true
    setRealtimeState('connected', '연결됨')
    scheduleAutoRefresh()
  }

  eventSource.addEventListener('payload', (event) => {
    realtimeConnected = true
    setRealtimeState('connected', '연결됨')
    renderPayload(JSON.parse(event.data))
  })

  eventSource.onerror = () => {
    realtimeConnected = false
    setRealtimeState('reconnecting', '재연결 중')
    scheduleAutoRefresh()
  }
}

async function postUserMessage(kind, body) {
  const loopLink = pendingLoopLink
  pendingLoopLink = null
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      speaker: 'user',
      kind,
      target: currentTarget,
      taskType: taskTypeEl.value,
      body,
      ...(loopLink || {}),
    }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || '메시지를 저장하지 못했습니다.')
  renderPayload(payload)
}

async function updateMessageStatus(id, status) {
  const response = await fetch('/api/messages/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || '상태를 저장하지 못했습니다.')
  renderPayload(payload)
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  if (autoRefreshEl.checked && !realtimeConnected) {
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

bodyEl.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    form.requestSubmit()
  }
})

for (const button of templateButtons) {
  button.addEventListener('click', () => {
    const template = templates[button.dataset.template]
    if (!template) return
    currentTarget = template.target
    kindEl.value = template.kind
    taskTypeEl.value = template.taskType || 'question'
    bodyEl.value = template.body
    updateTargetUI()
    bodyEl.focus()
  })
}

function toggleBodyPanel(button, className) {
  if (!button) return
  const enabled = !document.body.classList.contains(className)
  document.body.classList.toggle(className, enabled)
  button.setAttribute('aria-pressed', String(enabled))
}

function applyQuickTarget(button) {
  currentTarget = button.dataset.quickTarget
  kindEl.value = button.dataset.quickKind || 'direction'
  taskTypeEl.value = button.dataset.quickTask || targetPresets[currentTarget]?.taskType || 'question'
  updateTargetUI()
  bodyEl.focus()
}

function applyTemplate(templateKey) {
  const template = templates[templateKey]
  if (!template) return
  currentTarget = template.target
  kindEl.value = template.kind
  taskTypeEl.value = template.taskType || 'question'
  bodyEl.value = template.body
  updateTargetUI()
  bodyEl.focus()
}

function mountDevelopmentStudio() {
  if (document.querySelector('.dev-studio')) return
  const header = document.querySelector('.chat-header')
  if (!header) return

  const studio = document.createElement('section')
  studio.className = 'dev-studio'
  studio.setAttribute('aria-label', 'Agent Room development studio')
  studio.innerHTML = `
    <div class="studio-board">
      <div class="studio-title">
        <span>실제 개발 앱 화면</span>
        <h2>에이전트룸 작업실</h2>
        <p>기획, 구현, 검수, 저장 흐름을 한 화면에서 고르고 추적합니다.</p>
      </div>
      <div class="pipeline" aria-label="Development pipeline">
        <div class="pipeline-step active"><span>01</span><strong>기획</strong><small>범위와 담당 정리</small></div>
        <div class="pipeline-step"><span>02</span><strong>구현</strong><small>Claude / Codex 작업</small></div>
        <div class="pipeline-step"><span>03</span><strong>검수</strong><small>독립 확인</small></div>
        <div class="pipeline-step"><span>04</span><strong>저장</strong><small>기록과 배포</small></div>
      </div>
    </div>
    <div class="queue-shortcuts" aria-label="Work queue shortcuts">
      <button type="button" data-work-jump="yesterday"><span>전일 기준</span><strong>어제 항목만 보기</strong></button>
      <button type="button" data-work-jump="all"><span>전체 작업</span><strong>모든 큐 열기</strong></button>
      <button type="button" data-work-jump="claude"><span>Claude 큐</span><strong>구현 대기</strong></button>
      <button type="button" data-work-jump="codex"><span>Codex 큐</span><strong>검수 대기</strong></button>
      <button type="button" data-work-jump="blocked"><span>막힘</span><strong>차단 이슈</strong></button>
    </div>
    <div class="proposal-grid" aria-label="Agent Room proposals">
      <button class="proposal-tile primary" type="button" data-proposal-template="shared-plan">
        <span>제안 1</span>
        <strong>메인 선택 패널</strong>
        <small>다음 개발 방향을 사용자가 바로 고르는 화면입니다.</small>
      </button>
      <button class="proposal-tile" type="button" data-proposal-template="local-task">
        <span>제안 2</span>
        <strong>로컬 개발 작업실</strong>
        <small>포트, 파일, 브라우저 확인을 작업 큐로 관리합니다.</small>
      </button>
      <button class="proposal-tile" type="button" data-proposal-template="codex-review">
        <span>제안 3</span>
        <strong>검수 관제 센터</strong>
        <small>검수 대기, 막힘, 위험 내용을 로그 없이 확인합니다.</small>
      </button>
      <button class="proposal-tile" type="button" data-proposal-template="harness-start">
        <span>제안 4</span>
        <strong>하네스 착수 흐름</strong>
        <small>개발 분석을 시작하고 결과를 같은 루프에 남깁니다.</small>
      </button>
    </div>
  `
  header.insertAdjacentElement('afterend', studio)
  for (const button of studio.querySelectorAll('[data-proposal-template]')) {
    button.addEventListener('click', () => applyTemplate(button.dataset.proposalTemplate))
  }
  for (const button of studio.querySelectorAll('[data-work-jump]')) {
    button.addEventListener('click', () => setWorkView(button.dataset.workJump))
  }
}

function localizeStaticChrome() {
  const eyebrow = document.querySelector('.eyebrow')
  if (eyebrow) eyebrow.textContent = 'JH 통합 구축 시스템 · 개발 작업실'
  const subtitle = document.querySelector('.subtitle')
  if (subtitle) subtitle.textContent = 'Claude와 Codex 작업을 한 화면에서 선택하고, 큐별로 들어가 확인하는 로컬 개발 프로그램'
  if (focusComposeEl) focusComposeEl.textContent = '새 작업'
  if (toggleToolsEl) toggleToolsEl.textContent = '작업 도구'
  if (toggleOpsEl) toggleOpsEl.textContent = '운영 상태'
  if (refreshEl) refreshEl.textContent = '새로고침'
  if (quickSyncEl) quickSyncEl.textContent = '동기화'
  if (quickUpdateEl) quickUpdateEl.textContent = '업데이트'
  if (exportLogEl) exportLogEl.textContent = '내보내기'
}

function mountYesterdayWorkView() {
  const workViews = document.querySelector('.work-views')
  if (!workViews || workViews.querySelector('[data-work-view="yesterday"]')) return
  const button = document.createElement('button')
  button.className = 'work-view active'
  button.type = 'button'
  button.dataset.workView = 'yesterday'
  button.textContent = '전일 기준'
  button.addEventListener('click', () => setWorkView('yesterday'))
  workViews.prepend(button)
  for (const item of workViewButtons) item.classList.remove('active')
}

function setWorkView(view) {
  currentWorkView = view
  for (const item of document.querySelectorAll('[data-work-view]')) {
    item.classList.toggle('active', item.dataset.workView === view)
  }
  for (const item of document.querySelectorAll('[data-work-jump]')) {
    item.classList.toggle('active', item.dataset.workJump === view)
  }
  activeMessageId = null
  renderMessages(currentMessages)
}

refreshEl.addEventListener('click', () => {
  loadRoom().catch((error) => setError(error.message))
})

quickSyncEl.addEventListener('click', () => {
  postUserMessage('sync', '동기화').catch((error) => setError(error.message))
})

quickUpdateEl.addEventListener('click', () => {
  postUserMessage('direction', '업데이트').catch((error) => setError(error.message))
})

exportLogEl.addEventListener('click', exportLog)
autoRefreshEl.addEventListener('change', scheduleAutoRefresh)
searchEl.addEventListener('input', () => renderMessages(currentMessages))
if (recentRoutingEl) {
  recentRoutingEl.addEventListener('click', () => {
    const message = currentMessages.find((item) => item.id === latestRoutedMessageId)
    if (!message) return
    activeMessageId = message.id
    currentFilter = 'all'
    for (const button of filterButtons) button.classList.toggle('active', button.dataset.filter === 'all')
    selectMessage(message)
    renderMessages(currentMessages)
  })
}

if (focusComposeEl) {
  focusComposeEl.addEventListener('click', () => bodyEl.focus())
}
if (toggleToolsEl) {
  toggleToolsEl.addEventListener('click', () => toggleBodyPanel(toggleToolsEl, 'show-tools'))
}
if (toggleOpsEl) {
  toggleOpsEl.addEventListener('click', () => toggleBodyPanel(toggleOpsEl, 'show-ops'))
}
for (const button of quickTargetButtons) {
  button.addEventListener('click', () => applyQuickTarget(button))
}
for (const button of targetButtons) {
  button.addEventListener('click', () => {
    currentTarget = button.dataset.target
    updateTargetUI()
  })
}

for (const button of statusButtons) {
  button.addEventListener('click', async () => {
    const selectedMessage = currentMessages.find((message) => message.id === activeMessageId)
    if (!selectedMessage || selectedMessage.status === 'logged') return
    try {
      setError('')
      await updateMessageStatus(selectedMessage.id, button.dataset.status)
      if (button.dataset.status === 'blocked') prepareBlockedFeedback(selectedMessage)
    } catch (error) {
      setError(error.message)
    }
  })
}

for (const button of workViewButtons) {
  button.addEventListener('click', () => {
    setWorkView(button.dataset.workView)
  })
}

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter
    for (const item of filterButtons) item.classList.toggle('active', item === button)
    renderMessages(currentMessages)
  })
}

mountYesterdayWorkView()
mountDevelopmentStudio()
mountAnswerPanel()
localizeStaticChrome()
setWorkView('yesterday')
updateTargetUI()
updateStatusUI(null)
loadRoom()
  .then(() => {
    startEventStream()
    scheduleAutoRefresh()
  })
  .catch((error) => {
    setRealtimeState('polling', '폴링')
    setError(error.message)
    scheduleAutoRefresh()
  })
