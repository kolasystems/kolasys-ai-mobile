//
//  ShareViewController.swift
//  KolasysShare
//
//  Receives audio shared from Voice Memos / Files / etc.
//  Writes the file to the App Group container so the main app can pick it up.
//

import UIKit
import SwiftUI
import Social
import UniformTypeIdentifiers
import Combine

private let APP_GROUP = "group.com.kolasystems.kolasysai"
private let PENDING_DIR = "pending-uploads"
private let BRAND_RED = Color(red: 0.79, green: 0.15, blue: 0.15) // #CA2625

@objc(ShareViewController)
class ShareViewController: UIViewController {

    private var hostingController: UIHostingController<ShareRootView>?
    private let viewModel = ShareViewModel()

    override func viewDidLoad() {
        super.viewDidLoad()

        let root = ShareRootView(viewModel: viewModel) { [weak self] in
            self?.complete()
        }
        let hosting = UIHostingController(rootView: root)
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(hosting)
        view.addSubview(hosting.view)
        NSLayoutConstraint.activate([
            hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        hosting.didMove(toParent: self)
        self.hostingController = hosting

        Task { await processSharedItems() }
    }

    private func processSharedItems() async {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            await MainActor.run { viewModel.fail("Nothing to share.") }
            return
        }

        for provider in attachments {
            // Try audio first, fall back to movie/data so Voice Memos m4a is caught.
            for typeId in [UTType.audio.identifier, UTType.movie.identifier, UTType.data.identifier] {
                if provider.hasItemConformingToTypeIdentifier(typeId) {
                    do {
                        let url = try await loadFile(from: provider, type: typeId)
                        let saved = try copyToAppGroup(from: url)
                        await MainActor.run { viewModel.succeed(saved.lastPathComponent) }
                        return
                    } catch {
                        await MainActor.run { viewModel.fail(error.localizedDescription) }
                        return
                    }
                }
            }
        }

        await MainActor.run { viewModel.fail("No audio file found in the share.") }
    }

    private func loadFile(from provider: NSItemProvider, type: String) async throws -> URL {
        return try await withCheckedThrowingContinuation { cont in
            provider.loadFileRepresentation(forTypeIdentifier: type) { url, err in
                if let err = err { cont.resume(throwing: err); return }
                guard let url = url else {
                    cont.resume(throwing: NSError(domain: "KolasysShare", code: -1, userInfo: [NSLocalizedDescriptionKey: "Empty file."]))
                    return
                }
                // The provided URL is sandboxed and gets cleaned up after this block,
                // so copy it to a temp file we own before resolving.
                let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
                do {
                    if FileManager.default.fileExists(atPath: tmp.path) {
                        try FileManager.default.removeItem(at: tmp)
                    }
                    try FileManager.default.copyItem(at: url, to: tmp)
                    cont.resume(returning: tmp)
                } catch {
                    cont.resume(throwing: error)
                }
            }
        }
    }

    private func copyToAppGroup(from src: URL) throws -> URL {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: APP_GROUP
        ) else {
            throw NSError(
                domain: "KolasysShare",
                code: -2,
                userInfo: [NSLocalizedDescriptionKey: "App Group not configured. Add the entitlement to both targets."]
            )
        }
        let pending = container.appendingPathComponent(PENDING_DIR, isDirectory: true)
        try FileManager.default.createDirectory(at: pending, withIntermediateDirectories: true)

        let timestamp = Int(Date().timeIntervalSince1970)
        let ext = src.pathExtension.isEmpty ? "m4a" : src.pathExtension
        let dest = pending.appendingPathComponent("share-\(timestamp).\(ext)")
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.copyItem(at: src, to: dest)
        return dest
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}

// MARK: - SwiftUI

private final class ShareViewModel: ObservableObject {
    enum State {
        case uploading
        case done(String)
        case error(String)
    }

    @Published var state: State = .uploading

    @MainActor func succeed(_ filename: String) { state = .done(filename) }
    @MainActor func fail(_ message: String) { state = .error(message) }
}

private struct ShareRootView: View {
    @ObservedObject var viewModel: ShareViewModel
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            ZStack {
                Circle()
                    .fill(BRAND_RED)
                    .frame(width: 64, height: 64)
                Image(systemName: "mic.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(.white)
            }

            Text("Kolasys AI")
                .font(.system(size: 17, weight: .bold))

            switch viewModel.state {
            case .uploading:
                VStack(spacing: 8) {
                    ProgressView()
                    Text("Uploading to Kolasys AI\u{2026}")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
            case .done:
                Text("Saved. The Kolasys AI app will upload it on next launch.")
                    .font(.system(size: 13))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            case .error(let msg):
                Text(msg)
                    .font(.system(size: 13))
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(BRAND_RED)
                    .cornerRadius(12)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
    }
}
