//
//  ShareViewController.swift
//  KolasysShare
//
//  Receives audio shared from Voice Memos / Files / etc.
//  Writes the file to the App Group container so the main app can pick it up.
//
//  Pure UIKit — no SwiftUI / UIHostingController to avoid the Xcode 16
//  SwiftUICore linker restriction that silently kills the extension.
//

import UIKit
import Social
import UniformTypeIdentifiers

private let APP_GROUP = "group.com.kolasystems.kolasysai"
private let PENDING_DIR = "pending-uploads"

class ShareViewController: UIViewController {

    private let stackView = UIStackView()
    private let iconView = UIView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let progressView = UIActivityIndicatorView(style: .medium)
    private let doneButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        processSharedItems()
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground

        // Icon circle
        let circle = UIView()
        circle.backgroundColor = UIColor(red: 0.79, green: 0.15, blue: 0.15, alpha: 1)
        circle.layer.cornerRadius = 32
        circle.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            circle.widthAnchor.constraint(equalToConstant: 64),
            circle.heightAnchor.constraint(equalToConstant: 64)
        ])

        let micImage = UIImageView(image: UIImage(systemName: "mic.fill"))
        micImage.tintColor = .white
        micImage.translatesAutoresizingMaskIntoConstraints = false
        micImage.contentMode = .scaleAspectFit
        circle.addSubview(micImage)
        NSLayoutConstraint.activate([
            micImage.centerXAnchor.constraint(equalTo: circle.centerXAnchor),
            micImage.centerYAnchor.constraint(equalTo: circle.centerYAnchor),
            micImage.widthAnchor.constraint(equalToConstant: 28),
            micImage.heightAnchor.constraint(equalToConstant: 28)
        ])

        // Title
        titleLabel.text = "Kolasys AI"
        titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
        titleLabel.textAlignment = .center

        // Status
        statusLabel.text = "Uploading to Kolasys AI…"
        statusLabel.font = .systemFont(ofSize: 13)
        statusLabel.textColor = .secondaryLabel
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0

        // Progress
        progressView.startAnimating()

        // Done button
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        doneButton.backgroundColor = UIColor(red: 0.79, green: 0.15, blue: 0.15, alpha: 1)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.layer.cornerRadius = 12
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        doneButton.isHidden = true
        NSLayoutConstraint.activate([
            doneButton.heightAnchor.constraint(equalToConstant: 48)
        ])

        // Stack
        stackView.axis = .vertical
        stackView.alignment = .center
        stackView.spacing = 16
        stackView.translatesAutoresizingMaskIntoConstraints = false
        [circle, titleLabel, progressView, statusLabel, doneButton].forEach {
            stackView.addArrangedSubview($0)
            if $0 == doneButton {
                $0.translatesAutoresizingMaskIntoConstraints = false
            }
        }

        view.addSubview(stackView)
        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            doneButton.widthAnchor.constraint(equalTo: stackView.widthAnchor)
        ])
    }

    private func processSharedItems() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments,
              let provider = attachments.first else {
            showError("Nothing to share.")
            return
        }

        let types = ["public.audio", "com.apple.m4a-audio", "public.mpeg-4-audio", "public.movie", "public.data"]
        for typeId in types {
            if provider.hasItemConformingToTypeIdentifier(typeId) {
                provider.loadFileRepresentation(forTypeIdentifier: typeId) { [weak self] url, error in
                    DispatchQueue.main.async {
                        if let error = error {
                            self?.showError(error.localizedDescription)
                            return
                        }
                        guard let url = url else {
                            self?.showError("Could not load file.")
                            return
                        }
                        do {
                            let saved = try self?.copyToAppGroup(from: url)
                            self?.showSuccess(saved?.lastPathComponent ?? "file")
                        } catch {
                            self?.showError(error.localizedDescription)
                        }
                    }
                }
                return
            }
        }
        showError("No audio file found.")
    }

    private func copyToAppGroup(from src: URL) throws -> URL {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: APP_GROUP
        ) else {
            throw NSError(domain: "KolasysShare", code: -2,
                userInfo: [NSLocalizedDescriptionKey: "App Group not configured."])
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

    private func showSuccess(_ filename: String) {
        progressView.stopAnimating()
        progressView.isHidden = true
        statusLabel.text = "Saved! Kolasys AI will upload it on next launch."
        doneButton.isHidden = false
    }

    private func showError(_ message: String) {
        progressView.stopAnimating()
        progressView.isHidden = true
        statusLabel.text = message
        statusLabel.textColor = .systemRed
        doneButton.isHidden = false
    }

    @objc private func doneTapped() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
