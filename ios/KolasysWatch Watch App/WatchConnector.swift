import Foundation
import WatchConnectivity
import Combine

class WatchConnector: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnector()

    @Published var isRecording = false
    @Published var elapsedSeconds: Int = 0

    private var timer: Timer?
    private var session: WCSession?

    var elapsedFormatted: String {
        let m = elapsedSeconds / 60
        let s = elapsedSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    func activateSession() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        self.session = s
    }

    func toggleRecording() {
        let command = isRecording ? "stop" : "start"
        sendMessage(["command": command])
        // Optimistic UI update — iPhone will confirm via state update
        if !isRecording {
            isRecording = true
            startTimer()
        } else {
            isRecording = false
            stopTimer()
            elapsedSeconds = 0
        }
    }

    private func sendMessage(_ message: [String: Any]) {
        guard let s = session, s.isReachable else { return }
        s.sendMessage(message, replyHandler: nil, errorHandler: { err in
            print("[WatchConnector] send error: \(err)")
        })
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                self?.elapsedSeconds += 1
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            if let state = message["state"] as? String {
                self.isRecording = state == "recording"
                if !self.isRecording {
                    self.stopTimer()
                    self.elapsedSeconds = 0
                }
            }
            if let elapsed = message["elapsed"] as? Int {
                self.elapsedSeconds = elapsed
            }
        }
    }
}
