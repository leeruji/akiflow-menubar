# akiflow-menubar

노션 캘린더처럼 맥 상단 메뉴 막대에 [Akiflow](https://akiflow.com) 일정을 띄우는 Claude Code 모드입니다.

- 지금 진행 중인 할 일·일정이 있으면 `이름 · 25분 남음`
- 없으면 가장 가까운 다음 일정을 `이름 · 1시간 5분 후`
- 둘 다 없으면 숨습니다. 누르면 「아키플로우에서 열기」로 그 항목을 엽니다.

시간을 정한 할 일과 캘린더 일정을 함께 보여 줍니다. 하루 종일 일정과 거절한 일정은 뺍니다.

## 설치

터미널의 Claude Code 프롬프트에서:

```
/plugin install akiflow-menubar --marketplace leeruji/akiflow-menubar
```

셸에서:

```bash
claude plugin install akiflow-menubar --marketplace leeruji/akiflow-menubar
```

데스크톱 앱에서는 프롬프트 옆 + → Plugins → Add marketplace 에 `leeruji/akiflow-menubar` 를 넣고 Add plugin 을 누릅니다.

## 준비할 것

- macOS, Xcode 명령줄 도구(`swiftc`). 표시기는 처음 실행할 때 한 번 직접 빌드합니다.
- Claude Code 에 `akiflow` 라는 이름으로 연결된 Akiflow MCP 서버.
- 자동 모드를 쓴다면 `~/.claude/settings.json` 의 `permissions.allow` 에 `"mcp__akiflow__get_schedule"` 을 넣어 주세요. 모드가 혼자 보내는 요청이라 허용하지 않으면 막힙니다. 이 도구는 일정을 읽기만 합니다.

## 동작 방식

- 모드가 2분마다 Akiflow 에서 어제부터 모레까지의 일정을 받아 `schedule.json` 에 둡니다.
- 메뉴 막대 표시기(`native/menubar.swift`)가 15초마다 그 파일을 읽어 남은 시간을 다시 계산합니다.
- Claude Code 세션이 열려 있는 동안만 보입니다. 세션을 여러 개 열어도 표시기는 하나만 뜹니다.
- 받아 오기에 실패하면 모드 폴더의 `error.txt` 에 이유를 남깁니다.
- 길이를 정하지 않은 할 일은 30분짜리로 셉니다.
