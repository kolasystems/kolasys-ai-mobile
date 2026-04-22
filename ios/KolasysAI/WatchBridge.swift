import Foundation
import WatchConnectivity
import React

@objc(WatchBridge)
class WatchBridge: RCTEventEmitter, WCSessionDelegate {
    static let shared = WatchBridge()

    private var session: WCSession?
    private var hasListeners = false

    override func supportedEvents() -> [String] {
        return ["WatchCommand"]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    @objc func activate() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        self.session = s
    }

    @objc func sendState(_ state: String, elapsed: Int) {
        guard let s = session, s.isReachable else { return }
        s.sendMessage(["state": state, "elapsed": elapsed], replyHandler: nil, errorHandler: nil)
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard hasListeners, let command = message["command"] as? String else { return }
        sendEvent(withName: "WatchCommand", body: ["command": command])
    }
}
