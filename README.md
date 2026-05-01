# JH Agent Room

JH 통합 구축 시스템에서 사용자, Claude, Codex가 같은 기준을 보고 협업하기 위한 독립 로컬 대시보드입니다.

## 역할

- 사용자: 방향, 지시, 승인
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

1. 사용자는 브라우저 입력창에 지시를 남깁니다.
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
G:\내 드라이브\JH-SHARED\agent-room-messages.jsonl
```

## 보안 기준

- 일반 UI에서는 사용자 발화만 저장합니다.
- Claude/Codex 발화는 `ADMIN_SECRET` 검증을 통과한 스크립트 요청만 허용합니다.
- `scripts\start-agent-room.ps1`이 `.env`와 `ADMIN_SECRET`을 자동 생성합니다.
- API 응답과 화면에는 로컬 절대 경로를 노출하지 않습니다.

## 운영 기능

- 자동 새로고침: 5초 간격
- 메시지 필터: 전체, 사용자, Claude, Codex
- 빠른 동기화 버튼
- 현재 로그 JSON 내보내기
- 기준 파일 상태 확인
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

공유 메시지 로그는 코드 저장소에 커밋하지 않고 `G:\내 드라이브\JH-SHARED\agent-room-messages.jsonl`을 사용합니다.
각 PC는 로컬 실행본만 GitHub에서 동기화합니다.
