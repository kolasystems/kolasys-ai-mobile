import SwiftUI

@main
struct KolasysWatchApp: App {
    @StateObject private var connector = WatchConnector.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connector)
        }
    }
}
