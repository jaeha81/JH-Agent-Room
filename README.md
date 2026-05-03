# JH Agent Room

JH 통합 구축 시스템에서 사용자, Claude, Codex가 같은 기준을 보고 협업하기 위한 독립 로컬 대시보드입니다.

## 역할

- 사용자: 방향, 공유, 승인
- Claude: 구현 및 운영 총괄
- Codex: 독립 검수 및 사용자 직접 보고

## 실행

권장 실행:

```powershell
cd D:\ai프로젝트\JH-Agent-Room
powershell -ExecutionPolicy Bypass -File .\scripts\start-agent-room.ps1
```

브라우저에서 `http://localhost:3100`을 엽니다.

## 실제 사용 흐름

1. 사용자는 브라우저 입력창에 공유할 작업 내용을 남깁니다.
2. `동기화` 버튼을 누르면 사용자 동기화 요청과 Claude/Codex 자동 로그가 남습니다.
3. Claude는 구현 내용을 아래 명령으로 남깁니다.
4. Codex는 검수 결과를 아래 명령으로 남깁니다.
5. 화면은 5초마다 자동 새로고침됩니다.

Claude 메시지:

```powershell
.\scripts\post-message.ps1 -Speaker claude -Kind implementation -Body "작업 내용"
```

Codex 메시지:

```powershell
.\scripts\post-message.ps1 -Speaker codex -Kind review -Body "검수 결과"
```

## 저장소

메시지는 append-only JSONL 형식으로 아래 파일에 저장됩니다.

```text
G:\내 드라이브\JH-SHARED\01_AGENT_ROOM\agent-room-messages.jsonl
```

## 보안 기준

- 일반 UI에서는 사용자 발화만 저장합니다.
- Claude/Codex 발화는 `ADMIN_SECRET` 검증을 통과한 스크립트 요청만 허용합니다.
- `scripts\start-agent-room.ps1`이 `.env`와 `ADMIN_SECRET`을 자동 생성합니다.
- API 응답과 화면에는 로컬 절대 경로를 노출하지 않습니다.

## 운영 기능

- 자동 새로고침: 5초 간격
- 실시간 감지: `/api/events` SSE 연결
- 대상별 작업 큐: `/api/queue?target=claude|codex|gpt|all`
- 메시지 필터: 전체, 사용자, Claude, Codex
- 새 라우팅 배너와 메시지 카드 `새 공유` 강조
- 메시지 카드 및 상세 패널에서 상태 변경: `todo`, `working`, `review`, `blocked`, `done`
- 빠른 동기화 버튼
- 현재 로그 JSON 내보내기
- 기준 파일 상태 확인

## 실시간 공유 감지

Agent Room의 대상 버튼은 명령을 즉시 실행하는 버튼이 아니라 공유 내용을 작업 큐로 분류하는 기준입니다.
사용자가 작업 내용을 공유하면 서버는 메시지를 append-only 로그에 저장하고 `/api/events`로 연결된 화면과 감시자에게 즉시 알립니다.
또한 `AGENT_ROOM_AUTO_ACK`가 `0`이 아니면 대상 큐에 맞는 자동 접수 응답을 즉시 남깁니다.
이 응답은 실제 Claude/Codex의 최종 답변이 아니라, 해당 공유 내용이 어느 큐에 들어갔는지 확인시키는 라우터 응답입니다.

Agent Room은 한 화면 안의 채팅만을 전제로 하지 않습니다.
사용자, Claude, Codex가 각각 독립 웹앱, 데스크톱 앱, 로컬 터미널에서 작업하더라도 같은 API와 JSONL 로그를 통해 서로의 작업 큐로 메시지를 라우팅합니다.
즉 `사용자 -> Claude/Codex`뿐 아니라 `Claude -> Codex 검수 요청`, `Codex -> Claude 수정 요청`, `Claude/Codex -> 공유 기록`도 같은 방식으로 남깁니다.

분류 기준:

- `Claude+Codex`: 두 에이전트가 함께 읽고 Claude는 구현/운영, Codex는 검증/위험 관점으로 판단합니다.
- `Claude`: Claude 구현 작업 큐입니다.
- `Codex`: Codex 검수 작업 큐입니다.
- `Harness 착수`: JH Harness 대시보드에서 개발 착수 분석, 프롬프트, 체크리스트를 만들 작업입니다.
- `Codex: GitHub`: Codex가 저장소, 브랜치, 커밋, PR, CI 상태를 확인할 작업입니다.
- `Codex: 로컬`: Codex가 현재 PC의 파일, 서버, 포트, 브라우저 상태를 확인할 작업입니다.

에이전트용 큐 확인:

```powershell
Invoke-RestMethod http://127.0.0.1:3100/api/queue?target=codex
Invoke-RestMethod http://127.0.0.1:3100/api/queue?target=claude
```

운영 스크립트:

```powershell
# Codex 대기열 1회 확인
powershell -ExecutionPolicy Bypass -File .\scripts\get-queue.ps1 -Target codex

# Codex 대기열 실시간 감시
powershell -ExecutionPolicy Bypass -File .\scripts\watch-queue.ps1 -Target codex

# Claude 대기열 실시간 감시
powershell -ExecutionPolicy Bypass -File .\scripts\watch-queue.ps1 -Target claude

# 공유 상태 변경
powershell -ExecutionPolicy Bypass -File .\scripts\set-message-status.ps1 -Id "MESSAGE_ID" -Status working

# 막힘 상태 표시
powershell -ExecutionPolicy Bypass -File .\scripts\set-message-status.ps1 -Id "MESSAGE_ID" -Status blocked
```

Claude/Codex가 Agent Room에 직접 결과를 등록하려면 `.env`의 `ADMIN_SECRET`을 사용하는 등록 스크립트를 거쳐야 합니다.
관리 시크릿 없이 허용되는 것은 사용자 공유 등록과 읽기 API뿐입니다.

독립 앱/로컬 작업 중 교차 라우팅 예시:

```powershell
# Claude가 Codex에게 검수 요청
powershell -ExecutionPolicy Bypass -File .\scripts\post-message.ps1 `
  -Speaker claude `
  -Kind implementation `
  -Target codex `
  -TaskType review `
  -Body "Codex 검수 요청: 변경 파일과 실행 결과를 확인해 주세요."

# Codex가 Claude에게 수정 요청
powershell -ExecutionPolicy Bypass -File .\scripts\post-message.ps1 `
  -Speaker codex `
  -Kind review `
  -Target claude `
  -TaskType implementation `
  -Body "Claude 수정 요청: 검수 결과 P2 항목을 반영해 주세요."
```

HTTP API를 호출할 수 없는 앱은 공유 폴더 파일 드롭 방식으로 라우팅합니다.
아래 폴더에 JSON 파일이 생성되면 Agent Room 서버가 자동으로 읽어 대상 큐로 편입합니다.

```text
G:\내 드라이브\JH-SHARED\01_AGENT_ROOM\inbox
```

파일 드롭 예시:

```powershell
# Claude 앱/터미널에서 Codex 검수 큐로 전달
powershell -ExecutionPolicy Bypass -File .\scripts\drop-route-message.ps1 `
  -Speaker claude `
  -Kind implementation `
  -Target codex `
  -TaskType review `
  -Body "Codex 검수 요청: 독립 Claude 작업 결과를 확인해 주세요."

# Codex 앱/터미널에서 Claude 구현 큐로 전달
powershell -ExecutionPolicy Bypass -File .\scripts\drop-route-message.ps1 `
  -Speaker codex `
  -Kind review `
  -Target claude `
  -TaskType implementation `
  -Body "Claude 수정 요청: 독립 Codex 검수 결과를 반영해 주세요."
```

처리된 파일은 `01_AGENT_ROOM\processed`로 이동하고, 실패한 파일은 `01_AGENT_ROOM\failed`로 이동합니다.
처리 이력은 `03_LOGS\agent-room-route-ingest.jsonl`에 append-only로 남습니다.

## Chrome 확장 공유

현재 웹페이지를 Agent Room으로 바로 공유하려면 확장 MVP를 사용합니다.

위치:

```text
D:\ai프로젝트\JH-Agent-Room\extension\agent-room-share
```

설치:

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드`를 누릅니다.
4. 위 `extension\agent-room-share` 폴더를 선택합니다.

기능:

- 현재 탭 제목과 URL 자동 수집
- 페이지 선택 텍스트 자동 수집
- 공유 대상 선택: Claude, Codex, Claude+Codex, Harness, GitHub, Local
- 작업 유형 선택
- Agent Room 연결 상태 확인
- 최근 열린 피드백 루프 선택 후 `loopId`, `replyTo` 자동 입력
- Agent Room 대시보드 바로 열기
- Agent Room API 직접 공유
- API 실패 시 JSON 복사 또는 JSON 파일 저장

팝업 동작 자동 검증:

```powershell
$env:NODE_PATH='C:\Users\user1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
& 'C:\Users\user1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\scripts\test-extension-popup.js
```

JSON 파일을 저장한 경우 아래 inbox에 넣으면 Agent Room 서버가 자동 수집합니다.

```text
G:\내 드라이브\JH-SHARED\01_AGENT_ROOM\inbox
```

## Claude/Codex 피드백 루프

Claude와 Codex는 강점이 다르므로 단발 메시지가 아니라 같은 `loopId` 안에서 요청, 구현, 검수, 수정, 재검수를 반복합니다.

운영 원칙:

- Claude는 구현/운영 판단을 남길 때 같은 루프에서 Codex 검수 요청을 보냅니다.
- Codex는 검수/리스크 판단을 남길 때 같은 루프에서 Claude 수정 요청을 보냅니다.
- 새 작업은 `loopId`가 없으면 서버가 원본 메시지 ID를 루프 ID로 자동 지정합니다.
- 후속 답변은 `-LoopId`와 `-ReplyTo`를 지정해 기존 루프에 연결합니다.
- 루프는 모든 실제 공유 메시지가 `done`이 되면 닫힌 것으로 봅니다.
- `[Agent Room 자동 접수]`는 보조 기록으로만 계산하며, 자동 접수만 있는 루프는 운영 패널에서 제외합니다.

루프 확인:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\get-loops.ps1 -Status open
```

후속 메시지 예시:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\post-message.ps1 `
  -Speaker codex `
  -Kind review `
  -Target claude `
  -TaskType implementation `
  -LoopId "LOOP_ID" `
  -ReplyTo "MESSAGE_ID" `
  -Body "검수 결과: P2 항목 수정 필요. 같은 루프에서 Claude 수정 요청."
```

자동 접수 끄기:

```powershell
AGENT_ROOM_AUTO_ACK=0
```
## 다른 PC에서 사용

처음 설치:

```powershell
cd C:\ai프로젝트
git clone https://github.com/jaeha81/JH-Agent-Room.git
cd JH-Agent-Room
powershell -ExecutionPolicy Bypass -File .\scripts\start-agent-room.ps1
```

집 PC처럼 `D:\ai프로젝트`를 쓰는 환경이면 첫 줄만 아래처럼 바꿉니다.

```powershell
cd D:\ai프로젝트
```

업데이트:

```powershell
cd C:\ai프로젝트\JH-Agent-Room
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\start-agent-room.ps1
```

공유 메시지 로그는 코드 저장소에 커밋하지 않고 `G:\내 드라이브\JH-SHARED\01_AGENT_ROOM\agent-room-messages.jsonl`을 사용합니다.
각 PC는 로컬 실행본만 GitHub에서 동기화합니다.

## 코드 변경 GitHub 반영 규칙

Agent Room의 코드, 스크립트, README, 운영 문서가 바뀐 경우에는 다른 PC에서도 같은 실행본을 쓰도록 GitHub에 반영합니다.

원칙:

- 코드 변경은 `git status`로 변경 파일을 확인합니다.
- 실행 또는 문법 검증이 가능한 경우 먼저 확인합니다.
- 민감정보가 담긴 `.env`와 로컬 로그 파일은 커밋하지 않습니다.
- 검증된 변경만 커밋하고 `git push origin main`으로 반영합니다.
- Agent Room 화면의 `동기화` 버튼은 GitHub push가 아니라 공유 로그 기록입니다.
- Claude가 Agent Room 작업 중 코드를 수정한 경우, Codex가 최종 검수한 뒤 커밋/푸쉬 여부를 판단합니다.
- Codex는 Agent Room 세션 종료 또는 사용자 종료 요청 시 `git status`를 확인하고, 푸쉬해야 할 검증된 코드 변경이 있으면 GitHub 반영까지 진행합니다.

수동 반영:

```powershell
cd C:\ai프로젝트\JH-Agent-Room
git status
git add README.md server.js public scripts
git commit -m "describe change"
git push origin main
```

Codex나 Claude가 Agent Room 코드를 수정한 경우에는 사용자에게 별도 요청이 없어도 검증 후 GitHub 반영 여부를 보고하고, 승인된 운영 범위에서는 커밋/푸쉬까지 진행합니다.

종료 전 Codex 확인:

```powershell
cd C:\ai프로젝트\JH-Agent-Room
git status
npm run dev
git log -1 --oneline
```

확인 기준:

- 변경 파일이 코드/스크립트/문서인지 확인합니다.
- `.env`, 메시지 JSONL, 로컬 로그는 제외합니다.
- 실행 확인 후 필요한 경우 커밋하고 `git push origin main`을 수행합니다.
- 푸쉬 완료 후 커밋 해시와 남은 변경 여부를 사용자에게 보고합니다.

## 3대 PC 동기화 규칙

Agent Room은 3대 PC를 오가는 작업을 위해 아래 공유 기준을 사용합니다.

```text
G:\내 드라이브\JH-SHARED\00_SYSTEM\sync-protocol.md
G:\내 드라이브\JH-SHARED\00_SYSTEM\jh-system.md
G:\내 드라이브\JH-SHARED\00_SYSTEM\paths.md
```

사용자가 `동기화` 또는 `업데이트`를 요청하면 Agent Room은 현재 PC 스냅샷을 아래에 append-only로 기록합니다.

```text
G:\내 드라이브\JH-SHARED\03_LOGS\sync-state.jsonl
```

메시지 로그는 아래 위치에 저장합니다.

```text
G:\내 드라이브\JH-SHARED\01_AGENT_ROOM\agent-room-messages.jsonl
```

## Claude 컨텍스트 제한

Claude는 동기화 요청을 받았다고 해서 전역 `~/.claude/CLAUDE.md` 전체를 매번 읽지 않습니다.
먼저 `JH-SHARED/00_SYSTEM`의 최소 기준 파일만 읽고, 필요한 경우에만 현재 프로젝트 지침이나 전역 지침의 관련 섹션을 추가로 읽습니다.

Claude 전달 브리핑:

```text
G:\내 드라이브\JH-SHARED\02_HANDOFF\claude-sync-context-guard.md
```
## 다른 PC에서 Claude/Codex 전제 확인

다른 PC에서 Claude 또는 Codex가 시작하면 전역 지침 전체를 읽기 전에 아래 명령으로 최소 공유 컨텍스트를 확인합니다.

```powershell
cd C:\ai프로젝트\JH-Agent-Room
powershell -ExecutionPolicy Bypass -File .\scripts\check-agent-context.ps1
```

집 PC에서는 경로만 바꿉니다.

```powershell
cd D:\ai프로젝트\JH-Agent-Room
powershell -ExecutionPolicy Bypass -File .\scripts\check-agent-context.ps1
```

확인 대상:

- `JH-SHARED\00_SYSTEM\agent-onboarding.md`
- `JH-SHARED\00_SYSTEM\sync-protocol.md`
- `JH-SHARED\00_SYSTEM\jh-system.md`
- `JH-SHARED\00_SYSTEM\paths.md`
- `JH-SHARED\02_HANDOFF\claude-sync-context-guard.md`

확인 후 Agent Room에서 `동기화` 또는 `업데이트`를 눌러 현재 PC 스냅샷을 남깁니다.
## 사전 검수 필수 규칙

Agent Room을 통한 Claude 작업은 사용자에게 최종 전달되기 전에 Codex 검수를 항상 거칩니다.

순서:

1. 사용자 공유
2. Claude 구현 또는 보고 초안
3. Claude가 코드를 건드린 경우 변경 파일과 실행 결과를 Agent Room에 남김
4. Codex 독립 검수
5. Codex가 필요 시 커밋/푸쉬 대상 여부 확인
6. Codex 검수 결과 기록
7. 사용자 최종 보고

Claude는 Codex 검수 없이 완료 보고를 확정하지 않습니다.
## 일일보고 운영

PC에서 진행한 작업은 매일 날짜별 보고서로 정리합니다.

저장 위치:

```text
G:\내 드라이브\JH-SHARED\04_DAILY_REPORTS\YYYY\YYYY-MM\YYYY-MM-DD.md
```

새 일일보고 생성:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-daily-report.ps1
```

작업 항목 추가:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\add-daily-entry.ps1 -Speaker codex -Kind verification -Body "검증 결과"
```

Markdown 정리본 재생성:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-daily-report.ps1
```

충돌 방지 규칙:

- Claude와 Codex는 같은 `YYYY-MM-DD.md`를 동시에 직접 편집하지 않습니다.
- 각 주체의 원본 입력은 `YYYY-MM-DD.entries\주체\PC명.jsonl`에 append-only로 저장합니다.
- `YYYY-MM-DD.md`는 JSONL 원본에서 재생성되는 읽기용 정리본으로 취급합니다.

일일보고 포함 항목:

- 오늘 작업 요약
- 완료된 변경
- 주요 이슈 및 처리 상태
- 검증 결과
- 남은 작업
- Claude에게 전달할 내용
- 다음 시작 시 체크 명령

2026-05-01 작업 보고:

```text
G:\내 드라이브\JH-SHARED\04_DAILY_REPORTS\2026\2026-05\2026-05-01.md
```

다음날 또는 다른 PC에서 시작할 때 Claude/Codex는 최근 일일보고와 `check-agent-context.ps1` 결과를 함께 확인합니다.

## 병렬 작업 잠금

Claude와 Codex가 동시에 여러 작업을 진행할 때는 `taskId` 기준으로 작업 잠금과 작업 로그를 남깁니다.

저장 위치:

```text
G:\내 드라이브\JH-SHARED\05_TASK_LOCKS\active\TASK_ID.json
G:\내 드라이브\JH-SHARED\05_TASK_LOCKS\done\YYYY-MM\TASK_ID.json
G:\내 드라이브\JH-SHARED\06_TASK_LOGS\YYYY-MM\TASK_ID.jsonl
```

작업 시작:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-task.ps1 -Owner claude -Mode implementation -Title "작업 제목" -Targets "D:\ai프로젝트\project\src"
```

충돌 확인:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-task-conflicts.ps1 -Targets "D:\ai프로젝트\project\src"
```

작업 기록:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\log-task.ps1 -TaskId "TASK_ID" -Speaker codex -Kind review -Body "검수 결과"
```

작업 완료:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\finish-task.ps1 -TaskId "TASK_ID" -Speaker claude
```

충돌 기준:

- 같은 대상 경로 또는 상하위 경로를 다른 active 작업이 사용 중이면 충돌로 판단합니다.
- 충돌 시 자동 진행하지 않고 사용자에게 보고합니다.
- `-Force`는 사용자가 명시 승인한 경우에만 사용합니다.
