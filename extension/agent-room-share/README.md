# JH Agent Room Share

Chrome extension MVP for sharing the current browser page into Agent Room.

## Install

1. Open `chrome://extensions` in Chrome.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:

```text
<JH-Agent-Room>\extension\agent-room-share
```

## Use

- `Agent Room URL`: default `http://127.0.0.1:3100`
- `Share Target`: Claude, Codex, Claude+Codex, Harness, GitHub, Local, Room
- `Task Type`: browser, question, plan, implementation, review, harness, github, local
- `Open Feedback Loop`: loads recent open loops from Agent Room and fills `Loop ID` / `Reply To`
- `Check`: verifies the Agent Room server through `/api/status`
- `Open Room`: opens the configured Agent Room dashboard URL
- `Share to Room`: posts directly to `/api/messages`
- `Copy JSON` / `Save JSON`: fallback when direct API sharing is unavailable

If direct sharing fails, save or copy the JSON payload and place it in:

```text
<JH-SHARED>\01_AGENT_ROOM\inbox
```

The Agent Room server ingests that inbox file and routes it into the target queue.
