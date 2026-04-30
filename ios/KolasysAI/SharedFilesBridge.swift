//
//  SharedFilesBridge.swift
//  KolasysAI
//
//  Exposes the App Group "pending-uploads" directory to React Native so the
//  JS layer can pick up files dropped in by the Share Extension.
//

import Foundation
import React

private let APP_GROUP = "group.com.kolasystems.kolasysai"
private let PENDING_DIR = "pending-uploads"

@objc(SharedFilesBridge)
class SharedFilesBridge: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  private func pendingDir() -> URL? {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: APP_GROUP
    ) else { return nil }
    let dir = container.appendingPathComponent(PENDING_DIR, isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  @objc(getPendingFiles:rejecter:)
  func getPendingFiles(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let dir = pendingDir() else {
      reject("E_NO_GROUP", "App Group not configured.", nil)
      return
    }
    do {
      let urls = try FileManager.default.contentsOfDirectory(
        at: dir,
        includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey],
        options: [.skipsHiddenFiles]
      )
      let payload: [[String: Any]] = urls.map { url in
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        let size = (attrs?[.size] as? NSNumber)?.intValue ?? 0
        let modified = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return [
          "uri": url.absoluteString,
          "path": url.path,
          "name": url.lastPathComponent,
          "size": size,
          "modifiedAt": modified,
        ]
      }
      resolve(payload)
    } catch {
      reject("E_LIST_FAILED", error.localizedDescription, error)
    }
  }

  @objc(deletePendingFile:resolver:rejecter:)
  func deletePendingFile(_ path: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    let url = URL(fileURLWithPath: path)
    do {
      if FileManager.default.fileExists(atPath: url.path) {
        try FileManager.default.removeItem(at: url)
      }
      resolve(true)
    } catch {
      reject("E_DELETE_FAILED", error.localizedDescription, error)
    }
  }
}
