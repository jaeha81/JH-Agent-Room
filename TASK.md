# JH-Agent-Room 작업 큐

## 진행 중
- [ ] 원격 루틴 Draft PR #1~#24 일괄 정리 — L0 승인 완료 (2026-09-27), 미결 항목은 본 파일로 이관 (출처: #2, #3, #5, #9, 08-10 최초 제기)
  - TASK.md 통합 정리 (본 파일) → CURRENT_STATE.md 갱신 → PR #1~#24 close → 루틴 브랜치 정리

## 대기 중
- [ ] [P0] Supabase brain-system 보안 조치 — L0 즉시 확인 필요 (출처: #3, 08-11 / 재알림 #8, 08-18)
  - Supabase 대시보드 Security Advisor 확인 후 조치
- [ ] [P1] 보안 알림 본인 여부 확인 (출처: #6, #7, #10, #12, 08-14~08-23)
  - Vercel: 팀 외부 계정의 무단 배포 시도 (08-16) + 새 로그인 감지 (08-23)
  - Notion: 새 기기 로그인 알림 (08-20)
  - Discord: 본인 미요청 로그인 링크 발송 (08-14)
- [ ] [P1] GitHub PAT — gh-cli 로컬 토큰 교체 (08-08 재발급 알림 수신) (출처: #1, 08-09)
- [ ] [P2] GroqCloud Llama 3.1 8B Instant 대체 모델 결정 — 비활성화 여부 확인 후 전환 (출처: #5, 08-13)
- [ ] [P2] Daily Plus Pipeline 복구 — pip install websocket-client playwright (현재 fallback 동작) (출처: #1, 08-09)
- [ ] [P2] Charlie 감사 스크립트 인코딩 수정 (UnicodeDecodeError) (출처: #1, 08-09)
- [ ] [P2] 원격 루틴 운영 방식 변경 — 매일 Draft PR 누적 방지 (단일 브랜치/PR 갱신 또는 저장소 외부 기록) (출처: #18, 08-30)
- [ ] [P2] backup/2026-09-25 브랜치 미병합 커밋 2건 검토 (save-codex-session.ps1 창구별 인계, UTF-8 출력 고정) — main 반영 여부 L0 판단 (출처: 브랜치 점검, 09-27)
- [ ] [P3] Codex 감시병 자동 인계 후속 — 같은 창구 자동 주입 여부 + guard record 확인 후 결과 보고 (출처: #2, 08-10)
- [ ] [P3] context_warning.py 변경분 Codex 검수 (출처: #15, 08-26)
- [ ] [P3] Oracle Cloud OCI IAM 데이터베이스 마이그레이션 점검 — 서비스 영향 여부 확인 (출처: #14, 08-25)
- [ ] [P3] 로그파일 루트 노출 정리 (우선순위 낮음 — L0 판단 후) (출처: main 기존 항목 / VALIDATION 재확인 #22, 09-10)

## 기한 지남 — 확인 필요
- [ ] 블랙야크 입찰 — 3개 지점 입찰자료 검토 + 경북 상주점 입찰서 제출 (마감 08-12 13:00) — 제출 완료 여부 기록 (출처: #1, 08-09 / #2, 08-10)
- [ ] Manus 계정 — 삭제 예정 공지(08-23 기한) + 데이터 백업 파일 확보 여부 확인 (출처: #6, 08-14 / #7, 08-16 / #9, 08-19)
- [ ] 위시켓 지원 프로젝트 5건 검토 기한 경과 (08-24, 08-26, 09-20, 09-22×2) — 진행/종료 여부 확인 (출처: #5, 08-13 / #14, 08-25 / #23, 09-19)

## 완료
- [x] VALIDATION 인벤토리 (2026-05-07, Claude)
- [x] REPO_REGISTRY.yml grade A 확정 (2026-05-07, 재하)
- [x] Phase 1 파일 배치 완료 + Codex diff 검수 PASS (2026-05-10, Claude/Codex)
- [x] REPO_REGISTRY.yml v2.0 — 전체 75개 레포 A/B/C/D 등급 분류 완료 (2026-05-10, 재하 확정)
- [x] JH-Agent-Room AGENTS.md 실제 생성 (2026-05-10, Claude)
- [x] Phase 3 — A등급 3개 레포 컨텍스트 파일 배치 완료 (2026-05-10, Claude)
  - jh-brain-system: AGENTS.md, CURRENT_STATE.md, TASK.md, VALIDATION.md 생성 (CLAUDE.md 보존)
  - jh-harness: CURRENT_STATE.md, TASK.md, VALIDATION.md 생성 (CLAUDE.md·AGENTS.md 보존)
  - jh-CapitalBridge Intelligence: CLAUDE.md, AGENTS.md, CURRENT_STATE.md, TASK.md, VALIDATION.md 생성
- [x] 음성 바이브 코딩 + Obsidian 연동 통합 구조 구축 핸드오프 기록 (2026-05-18, Claude)
- [x] Codex WARNING 해소 — 인코딩 재저장 + 경로 기준 명확화 (2026-05-18, Claude)