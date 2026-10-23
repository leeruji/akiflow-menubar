import type { Register } from 'claude-code'

// 아키플로우의 시간 정한 할 일과 캘린더 일정을 2분마다 받아 파일로 두고, 메뉴 막대 표시기가 그걸 읽는다
export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const file = `${$.plugin.root}/schedule.json`

    const refresh = async () => {
      const now = await $.clock.now()
      // 어제~모레를 넉넉히 받는다: 모드 안의 시간대를 몰라도 오늘이 빠지지 않게
      const day = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10)
      try {
        const r = await $.mcp.call('akiflow', 'get_schedule', {
          start_date: day(-1),
          end_date: day(2),
          entities: 'all',
          filters: { exclude_all_day: true },
        })
        const block = r.content.find((c) => c.type === 'text')
        const text = block?.type === 'text' ? block.text ?? '' : ''
        if (r.isError || !text) throw new Error(text || 'no text')
        const { tasks = [], events = [] } = JSON.parse(text) as { tasks?: any[]; events?: any[] }
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
      } catch (err) {
        // 디버그 기록은 데스크톱 앱에서 찾기 어려워 모드 폴더에 남긴다
        await $.fs.write(`${$.plugin.root}/error.txt`, `${new Date(await $.clock.now()).toISOString()} ${err}\n`)
      }
    }

    await refresh()
    $.clock.every(2 * 60_000, refresh)
    // 대화가 끝나거나 모드가 다시 불리면 표시기도 같이 꺼진다
    const bin = `${$.plugin.root}/native/menubar`
    void (async () => {
      // 표시기는 처음 한 번 이 맥에서 빌드한다(실행 파일은 저장소에 넣지 않음)
      await $.fs.stat(bin).catch(() =>
        $.process.run(['swiftc', '-O', `${bin}.swift`, '-o', bin], { timeoutMs: 300_000 }),
      )
      for await (const _ of $.process.spawn({ argv: [bin, file] })) {}
    })()
    return started
  })
}
