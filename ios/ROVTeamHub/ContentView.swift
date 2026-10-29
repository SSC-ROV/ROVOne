import SwiftUI
import WebKit

/// 網站狀態：載入進度
final class WebViewModel: ObservableObject {
    @Published var progress: Double = 1
    let home = URL(string: "https://iengineer.cc.cd")!
}

/// 原生 ↔ 網頁橋：把 APNs 設備令牌交給頁面（頁面再以登入者身分上報伺服器）
final class PushBridge {
    static let shared = PushBridge()
    weak var webView: WKWebView?
    var pendingToken: String?

    func deliver(token: String) {
        pendingToken = token
        send(token: token)
    }

    /// 頁面每次載入完成都重發一次（SPA 導航或刷新後 window 變數會重置）
    func resendIfPending() {
        guard let token = pendingToken else { return }
        send(token: token)
    }

    private func send(token: String) {
        webView?.evaluateJavaScript(
            "window.__setPushToken && window.__setPushToken(\"\(token)\")",
            completionHandler: nil
        )
    }
}

struct AppWebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // 預設資料倉庫：cookie 持久化，登入一次之後不用再登
        config.websiteDataStore = .default()
        // 網頁端接收設備令牌的函式（收到後帶著 session cookie 上報 /api/push/register）
        let pushScript = WKUserScript(
            source: """
            window.__setPushToken = function(t) {
              fetch('/api/push/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: t })
              });
            };
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(pushScript)

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.969, green: 0.965, blue: 0.953, alpha: 1) // #f7f6f3
        web.scrollView.backgroundColor = web.backgroundColor
        PushBridge.shared.webView = web

        // 下拉重新整理
        let refresh = UIRefreshControl()
        refresh.addTarget(
            context.coordinator,
            action: #selector(Coordinator.pullToRefresh(_:)),
            for: .valueChanged
        )
        web.scrollView.addSubview(refresh)
        context.coordinator.refreshControl = refresh
        context.coordinator.webView = web

        web.addObserver(context.coordinator, forKeyPath: "estimatedProgress", options: .new, context: nil)
        web.load(URLRequest(url: model.home))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.removeObserver(coordinator, forKeyPath: "estimatedProgress")
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate {
        let model: WebViewModel
        weak var webView: WKWebView?
        weak var refreshControl: UIRefreshControl?

        init(model: WebViewModel) {
            self.model = model
        }

        @objc func pullToRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
        }

        override func observeValue(
            forKeyPath keyPath: String?,
            of object: Any?,
            change: [NSKeyValueChangeKey: Any]?,
            context: UnsafeMutableRawPointer?
        ) {
            guard keyPath == "estimatedProgress", Thread.isMainThread else {
                super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
                return
            }
            model.progress = webView?.estimatedProgress ?? 1
        }

        // MARK: WKNavigationDelegate

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            refreshControl?.endRefreshing()
            model.progress = 1
            PushBridge.shared.resendIfPending()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            refreshControl?.endRefreshing()
        }

        /// 新視窗連結（購買連結等 target=_blank）交給 Safari 開啟
        func webView(
            _ webView: WKWebView,
            decide policy: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if policy.targetFrame == nil, let url = policy.request.url {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

struct ContentView: View {
    @StateObject private var model = WebViewModel()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some View {
        ZStack(alignment: .top) {
            // 底色與網站 slate-950 一致，載入時不閃白
            Color(red: 0.969, green: 0.965, blue: 0.953).ignoresSafeArea()
            AppWebView(model: model)
            if model.progress < 1 {
                ProgressView(value: model.progress)
                    .progressViewStyle(.linear)
                    .tint(.cyan)
                    .animation(.easeInOut(duration: 0.15), value: model.progress)
                    .zIndex(1)
            }
        }
        .onAppear {
            appDelegate.requestPushPermission()
        }
    }
}
