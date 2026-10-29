import type { Register } from 'claude-code'

// 아키플로우의 시간 정한 할 일과 캘린더 일정을 2분마다 받아 파일로 두고, 메뉴 막대 표시기가 그걸 읽는다
export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const file = `${$.plugin.root}/schedule.json`
    const errorFile = `${$.plugin.root}/error.txt`

    const refresh = async () => {
      const now = await $.clock.now()
      // 어제~모레를 넉넉히 받는다: 모드 안의 시간대를 몰라도 오늘이 빠지지 않게
      const day = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10)
      try {
        // 하루씩 받는다: 나흘 치를 한 번에 받으면 MCP 결과 크기 한도를 넘어 JSON 대신 "Error: result … exceeds" 글이 온다
        // shortcut: 하루 일정만으로도 한도를 넘으면 다시 깨진다, 그때는 entities 를 tasks·events 로 더 나눌 것
        const days = await Promise.all(
          [-1, 0, 1, 2].map(async (d) => {
            const r = await $.mcp.call('akiflow', 'get_schedule', {
              start_date: day(d),
              end_date: day(d),
              entities: 'all',
              filters: { exclude_all_day: true },
            })
            const block = r.content.find((c) => c.type === 'text')
            const text = block?.type === 'text' ? block.text ?? '' : ''
            if (r.isError || !text.startsWith('{')) throw new Error(text.slice(0, 200) || 'no text')
            return JSON.parse(text) as { tasks?: any[]; events?: any[] }
          }),
        )
        const tasks = days.flatMap((x) => x.tasks ?? [])
        // 자정을 넘는 일정은 이틀에 다 나오므로 하나만 남긴다
        const events = [...new Map(days.flatMap((x) => x.events ?? []).map((v) => [v.id, v])).values()]
        const items = [
          ...tasks
            .filter((t) => t.datetime && !t.done)
            // shortcut: 길이 없는 할 일은 30분으로 친다, 아키플로우 기본 길이가 다르면 바꿀 것
            .map((t) => ({ title: t.title, start: t.datetime, minutes: t.duration ?? 30, url: t.url })),
          ...events
            .filter((v) => !v.declined)
            .map((v) => ({ title: v.title, start: v.start, minutes: v.duration ?? 0, url: v.url })),
        ]
        await $.fs.write(file, JSON.stringify(items))
        await $.fs.write(errorFile, '') // 비어 있으면 마지막 받아 오기가 성공한 것
      } catch (err) {
        // 디버그 기록은 데스크톱 앱에서 찾기 어려워 모드 폴더에 남긴다
        await $.fs.write(errorFile, `${new Date(await $.clock.now()).toISOString()} ${err}\n`)
      }
    }

    await refresh()
    $.clock.every(2 * 60_000, refresh)
    // 대화가 끝나거나 모드가 다시 불리면 표시기도 같이 꺼진다
    const bin = `${$.plugin.root}/native/menubar`
    void (async () => {
      // 표시기는 이 맥에서 빌드한다(실행 파일은 저장소에 넣지 않음): 처음, 그리고 소스가 바뀌었을 때
      const built = await $.fs.stat(bin).catch(() => undefined)
      const source = await $.fs.stat(`${bin}.swift`)
      if (!built || built.mtimeMs < source.mtimeMs) {
        await $.process.run(['swiftc', '-O', `${bin}.swift`, '-o', bin], { timeoutMs: 300_000 })
      }
      for await (const _ of $.process.spawn({ argv: [bin, file] })) {}
    })()
    return started
  })
}
