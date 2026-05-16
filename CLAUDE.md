# JH-Agent-Room 운영 지침

## 이 레포의 역할
Agent Room 메시지 큐 관리 전용 저장소.
운영 도구이며 제품 저장소와 혼용 금지.

## 에이전트 컨텍스트 스코프
이 레포 작업 시 아래 파일만 우선 참조한다:
- CLAUDE.md (이 파일)
- AGENTS.md
- CURRENT_STATE.md
- TASK.md
- VALIDATION.md

스코프 밖 참조 허용 예외 → SYSTEM_CONTRACT.md §컨텍스트 격리 원칙 참조.

## 역할 분담
| 역할 | 담당 |
|------|------|
| 최종 승인 | 재하 (L0) |
| 구조·문서 | Claude (L2) |
| 코드 검수 | Codex (L3) — 수정은 L0 승인 필요 |

## G: 드라이브 파일 쓰기
PowerShell `Add-Content -Encoding UTF8` 권장.
Python3는 인코딩·동기화 충돌 전례가 있어 주의.
