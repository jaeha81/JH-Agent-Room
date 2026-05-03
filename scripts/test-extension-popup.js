const path = require('path')
const { chromium } = require('playwright')

const extensionDir = path.resolve(__dirname, '..', 'extension', 'agent-room-share')
const popupUrl = `file:///${path.join(extensionDir, 'popup.html').replace(/\\/g, '/')}`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 430, height: 760 } })

  const requests = []
  await page.addInitScript(() => {
    const store = {}
    window.chrome = {
      storage: {
        local: {
          async get(defaults) {
            return { ...defaults, ...store }
          },
          async set(values) {
            Object.assign(store, values)
          },
        },
      },
      tabs: {
        async query() {
          return [{
            id: 1,
            title: 'Agent Room Extension Test Page',
            url: 'https://example.test/work',
          }]
        },
        create({ url }) {
          window.__openedAgentRoomUrl = url
        },
      },
      scripting: {
        async executeScript() {
          return [{ result: 'Selected browser text' }]
        },
      },
    }
  })

  await page.route('http://127.0.0.1:3100/api/status', (route) => {
    requests.push({ method: route.request().method(), url: route.request().url() })
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        loops: [{
          id: 'loop-test-001',
          status: 'open',
          title: 'Extension feedback loop',
          lastActionMessage: { id: 'message-test-001' },
        }],
      }),
    })
  })

  await page.route('http://127.0.0.1:3100/api/messages', async (route) => {
    requests.push({
      method: route.request().method(),
      url: route.request().url(),
      body: route.request().postDataJSON(),
    })
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, loops: [] }),
    })
  })

  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#connection-state.is-connected', { timeout: 5000 })

  const initial = await page.evaluate(() => ({
    state: document.querySelector('#connection-state').textContent,
    host: document.querySelector('#page-host').textContent,
    loopOptions: [...document.querySelector('#loop-select').options].map((option) => option.value),
    status: document.querySelector('#status').textContent,
  }))

  await page.selectOption('#loop-select', 'loop-test-001')
  await page.fill('#memo', 'Extension automated share test')
  await page.click('#send')
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Shared'))

  const afterSend = await page.evaluate(() => ({
    loopId: document.querySelector('#loop-id').value,
    replyTo: document.querySelector('#reply-to').value,
    status: document.querySelector('#status').textContent,
  }))

  const postRequest = requests.find((request) => request.method === 'POST')
  if (!postRequest) throw new Error('No POST request was sent to /api/messages.')
  if (postRequest.body.loopId !== 'loop-test-001') throw new Error('loopId was not included in payload.')
  if (postRequest.body.replyTo !== 'message-test-001') throw new Error('replyTo was not included in payload.')
  if (!postRequest.body.body.includes('Selected browser text')) throw new Error('selected text was not included in payload.')

  await browser.close()

  console.log(JSON.stringify({
    ok: true,
    popupUrl,
    initial,
    afterSend,
    postTarget: postRequest.body.target,
    postTaskType: postRequest.body.taskType,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
