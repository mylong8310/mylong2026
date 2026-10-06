import UIKit
import WebKit
import CoreMotion

final class FitBalanceViewController: UIViewController, WKScriptMessageHandler {
    private let pedometer = CMPedometer()
    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 9/255, green: 14/255, blue: 11/255, alpha: 1)

        let contentController = WKUserContentController()
        contentController.add(self, name: "fitbridge")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.bounces = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.allowsBackForwardNavigationGestures = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "shared") else {
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "fitbridge")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "fitbridge",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "getTodaySteps", "requestActivityPermission":
            readTodaySteps()
        case "dialNumber":
            let payload = body["payload"] as? [String: Any]
            let raw = payload?["phone"] as? String ?? ""
            dialNumber(raw)
        default:
            break
        }
    }

    private func dialNumber(_ raw: String) {
        let allowed = raw.filter { $0.isNumber || $0 == "+" }
        guard !allowed.isEmpty,
              let url = URL(string: "tel://\(allowed)") else { return }
        UIApplication.shared.open(url)
    }

    private func readTodaySteps() {
        guard CMPedometer.isStepCountingAvailable() else {
            sendSteps(-1)
            return
        }

        let start = Calendar.current.startOfDay(for: Date())
        pedometer.queryPedometerData(from: start, to: Date()) { [weak self] data, error in
            guard error == nil, let count = data?.numberOfSteps.intValue else {
                self?.sendSteps(-2)
                return
            }
            self?.sendSteps(count)
        }
    }

    private func sendSteps(_ value: Int) {
        DispatchQueue.main.async { [weak self] in
            let js = "window.FitNative && window.FitNative.receiveSteps(\(value));"
            self?.webView.evaluateJavaScript(js)
        }
    }
}
