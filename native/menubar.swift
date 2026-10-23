// 메뉴 막대 표시기: 모드가 써 둔 할 일 목록(JSON)을 15초마다 읽어 지금 할 일·남은 시간을 보여 준다.
import AppKit

struct Item: Decodable { let title: String; let start: String; let minutes: Int; let url: String }

let path = CommandLine.arguments[1]
let fmt = DateFormatter()
fmt.locale = Locale(identifier: "en_US_POSIX")
fmt.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"  // 아키플로우는 시간대 없는 현지 시각을 준다

func span(_ s: TimeInterval) -> String {
  let m = Int((s / 60).rounded(.up))
  return m >= 60 ? "\(m / 60)시간" + (m % 60 > 0 ? " \(m % 60)분" : "") : "\(m)분"
}

func short(_ t: String) -> String { t.count > 22 ? String(t.prefix(21)) + "…" : t }

/// 진행 중이면 (할 일, "N분 남음"), 아니면 가장 가까운 다음 할 일과 "N분 후"
func pick(_ items: [Item], now: Date) -> (Item, String)? {
  let timed = items.compactMap { i in fmt.date(from: i.start).map { (i, $0, $0 + TimeInterval(i.minutes * 60)) } }
  if let c = timed.filter({ $0.1 <= now && now < $0.2 }).min(by: { $0.2 < $1.2 }) {
    return (c.0, "\(span(c.2.timeIntervalSince(now))) 남음")
  }
  if let n = timed.filter({ $0.1 > now }).min(by: { $0.1 < $1.1 }) {
    return (n.0, "\(span(n.1.timeIntervalSince(now))) 후")
  }
  return nil
}

final class App: NSObject, NSApplicationDelegate {
  let status: NSStatusItem = {
    let s = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    s.autosaveName = "akiflow-menubar"  // 위치를 기억시킨다(아래 처음 위치와 짝)
    return s
  }()
  var url: URL?

  func applicationDidFinishLaunching(_ n: Notification) {
    let menu = NSMenu()
    menu.addItem(withTitle: "아키플로우에서 열기", action: #selector(openTask), keyEquivalent: "").target = self
    status.menu = menu
    tick()
    Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { _ in self.tick() }
  }

  func tick() {
    let items = (try? Data(contentsOf: URL(fileURLWithPath: path)))
      .flatMap { try? JSONDecoder().decode([Item].self, from: $0) } ?? []
    guard let (item, left) = pick(items, now: Date()) else { status.isVisible = false; return }
    status.isVisible = true
    status.button?.title = "\(short(item.title)) · \(left)"
    url = URL(string: item.url)
  }

  @objc func openTask() { if let url { NSWorkspace.shared.open(url) } }
}

if CommandLine.arguments.count > 2 && CommandLine.arguments[2] == "--self-test" {
  let now = fmt.date(from: "2026-10-23T14:00:00")!
  let a = Item(title: "A", start: "2026-10-23T13:30:00", minutes: 60, url: "")
  let b = Item(title: "B", start: "2026-10-23T15:05:00", minutes: 30, url: "")
  precondition(pick([b, a], now: now)!.1 == "30분 남음" && pick([b, a], now: now)!.0.title == "A")
  precondition(pick([b], now: now)!.1 == "1시간 5분 후")
  precondition(pick([a], now: fmt.date(from: "2026-10-23T15:00:00")!) == nil)
  print("ok"); exit(0)
}

// 대화·모드 사본이 여럿이어도 메뉴 막대 항목은 하나만: 데이터 파일이 달라도 같은 잠금을 쓴다
if flock(open(NSTemporaryDirectory() + "akiflow-menubar.lock", O_CREAT | O_RDWR, 0o644), LOCK_EX | LOCK_NB) != 0 { exit(0) }

// 처음 위치: Hidden Bar 의 접기 단추(보통 613)보다 오른쪽이라 숨겨지지 않는다. 사용자가 끌어 옮긴 뒤로는 건드리지 않는다
// shortcut: 숫자가 클수록 왼쪽, 550 은 이 맥 기준. 다른 맥에서 숨으면 ⌘를 누른 채 끌어 옮기면 기억된다
let positionKey = "NSStatusItem Preferred Position akiflow-menubar"
if UserDefaults.standard.object(forKey: positionKey) == nil { UserDefaults.standard.set(550, forKey: positionKey) }

let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // 독 아이콘 없이 메뉴 막대에만
let delegate = App()
app.delegate = delegate
app.run()
