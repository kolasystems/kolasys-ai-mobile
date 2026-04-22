import SwiftUI
import WatchKit

struct ContentView: View {
    @EnvironmentObject var connector: WatchConnector

    var body: some View {
        VStack(spacing: 16) {
            // Status indicator
            Circle()
                .fill(connector.isRecording ? Color.red : Color.gray.opacity(0.3))
                .frame(width: 16, height: 16)
                .overlay(
                    Circle()
                        .stroke(connector.isRecording ? Color.red.opacity(0.4) : Color.clear, lineWidth: 6)
                        .scaleEffect(connector.isRecording ? 1.5 : 1)
                        .animation(connector.isRecording ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true) : .default, value: connector.isRecording)
                )

            // Elapsed timer
            if connector.isRecording {
                Text(connector.elapsedFormatted)
                    .font(.system(size: 28, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
            } else {
                Text("Kolasys AI")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.gray)
            }

            // Main control button
            Button(action: {
                connector.toggleRecording()
                WKInterfaceDevice.current().play(connector.isRecording ? .stop : .start)
            }) {
                ZStack {
                    Circle()
                        .fill(connector.isRecording ? Color.red : Color(red: 0.79, green: 0.15, blue: 0.15))
                        .frame(width: 64, height: 64)

                    Image(systemName: connector.isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .buttonStyle(PlainButtonStyle())

            Text(connector.isRecording ? "Tap to stop" : "Tap to record")
                .font(.system(size: 11))
                .foregroundColor(.gray)
        }
        .padding()
        .onAppear {
            connector.activateSession()
        }
    }
}
