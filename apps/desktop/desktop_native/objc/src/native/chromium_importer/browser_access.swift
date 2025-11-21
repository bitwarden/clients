import Cocoa
import Foundation

@objc public class BrowserAccessManager: NSObject {
    private let bookmarkKey = "com.bitwarden.chromiumImporter.bookmarks"

    private let browserPaths: [String: String] = [
        "Chrome": "Library/Application Support/Google/Chrome",
        "Chromium": "Library/Application Support/Chromium",
        "Microsoft Edge": "Library/Application Support/Microsoft Edge",
        "Brave": "Library/Application Support/BraveSoftware/Brave-Browser",
        "Arc": "Library/Application Support/Arc/User Data",
        "Opera": "Library/Application Support/com.operasoftware.Opera",
        "Vivaldi": "Library/Application Support/Vivaldi",
    ]

    /// Request access to a specific browser's directory
    /// Returns security bookmark data (used to persist permissions) as base64 string, or nil if user declined
    @objc public func requestAccessToBroswerDir(_ browserName: String) -> String? {
        // NSLog("[SWIFT] requestAccessToBroswerDir called for: \(browserName)")
        
        guard let relativePath = browserPaths[browserName] else {
            // NSLog("[SWIFT] Unknown browser: \(browserName)")
            return nil
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let browserPath = homeDir.appendingPathComponent(relativePath)
        
        // NSLog("[SWIFT] Browser path: \(browserPath.path)")

        // NSOpenPanel must be run on the main thread
        var selectedURL: URL?
        var panelResult: NSApplication.ModalResponse = .cancel

        if Thread.isMainThread {
            // NSLog("[SWIFT] Already on main thread")
            let openPanel = NSOpenPanel()
            openPanel.message =
                "Please select your \(browserName) data folder\n\nExpected location:\n\(browserPath.path)"
            openPanel.prompt = "Grant Access"
            openPanel.allowsMultipleSelection = false
            openPanel.canChooseDirectories = true
            openPanel.canChooseFiles = false
            openPanel.directoryURL = browserPath

            // NSLog("[SWIFT] About to call openPanel.runModal()")
            panelResult = openPanel.runModal()
            selectedURL = openPanel.url
            // NSLog("[SWIFT] runModal returned: \(panelResult.rawValue)")
        } else {
            // NSLog("[SWIFT] Dispatching to main queue...")
            DispatchQueue.main.sync {
                // NSLog("[SWIFT] Inside main queue dispatch block")
                let openPanel = NSOpenPanel()
                openPanel.message =
                    "Please select your \(browserName) data folder\n\nExpected location:\n\(browserPath.path)"
                openPanel.prompt = "Grant Access"
                openPanel.allowsMultipleSelection = false
                openPanel.canChooseDirectories = true
                openPanel.canChooseFiles = false
                openPanel.directoryURL = browserPath

                // NSLog("[SWIFT] About to call openPanel.runModal()")
                panelResult = openPanel.runModal()
                selectedURL = openPanel.url
                // NSLog("[SWIFT] runModal returned: \(panelResult.rawValue)")
            }
        }

        guard panelResult == .OK, let url = selectedURL else {
            // NSLog("[SWIFT] User cancelled access request or panel failed")
            return nil
        }
        
        // NSLog("[SWIFT] User selected URL: \(url.path)")

        let localStatePath = url.appendingPathComponent("Local State")
        guard FileManager.default.fileExists(atPath: localStatePath.path) else {
            // NSLog("[SWIFT] Selected folder doesn't appear to be a valid \(browserName) directory")

            let alert = NSAlert()
            alert.messageText = "Invalid Folder"
            alert.informativeText =
                "The selected folder doesn't appear to be a valid \(browserName) data directory. Please select the correct folder."
            alert.alertStyle = .warning
            alert.runModal()

            return nil
        }

        // access is temporary right now, persist it by creating a security bookmark
        do {
            let bookmarkData = try url.bookmarkData(
                options: .withSecurityScope,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )

            saveBookmark(bookmarkData, forBrowser: browserName)
           //  NSLog("[SWIFT] Successfully created and saved bookmark")
            return bookmarkData.base64EncodedString()
        } catch {
            // NSLog("[SWIFT] Failed to create bookmark: \(error)")
            return nil
        }
    }

    /// Check if we have stored bookmark for browser (doesn't verify it's still valid)
    @objc public func hasStoredAccess(_ browserName: String) -> Bool {
        return loadBookmark(forBrowser: browserName) != nil
    }

    /// Start accessing a browser directory using stored bookmark
    /// Returns the resolved path, or nil if bookmark is invalid/revoked
    @objc public func startAccessingBrowser(_ browserName: String) -> String? {
        guard let bookmarkData = loadBookmark(forBrowser: browserName) else {
            return nil
        }

        do {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: .withSecurityScope,
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )

            if isStale {
                // NSLog("Security bookmark for \(browserName) is stale, attempting to re-create it")
                do {
                    let newBookmarkData = try url.bookmarkData(
                        options: .withSecurityScope,
                        includingResourceValuesForKeys: nil,
                        relativeTo: nil
                    )

                    saveBookmark(newBookmarkData, forBrowser: browserName)
                } catch {
                    // NSLog("Failed to create bookmark: \(error)")
                    return nil
                }
            }

            guard url.startAccessingSecurityScopedResource() else {
                // NSLog("Failed to start accessing security-scoped resource")
                return nil
            }

            return url.path
        } catch {
            // NSLog("Failed to resolve bookmark: \(error)")
            return nil
        }
    }

    /// Stop accessing a browser directory (must be called after startAccessingBrowser)
    @objc public func stopAccessingBrowser(_ browserName: String) {
        guard let bookmarkData = loadBookmark(forBrowser: browserName) else {
            return
        }

        do {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: .withSecurityScope,
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )

            url.stopAccessingSecurityScopedResource()
        } catch {
            // NSLog("Failed to resolve bookmark for stop: \(error)")
        }
    }

    private func bookmarkKeyFor(_ browserName: String) -> String {
        return "\(bookmarkKey).\(browserName)"
    }

    private func saveBookmark(_ data: Data, forBrowser browserName: String) {
        let defaults = UserDefaults.standard
        let key = bookmarkKeyFor(browserName)
        defaults.set(data, forKey: key)
        defaults.synchronize()
    }

    private func loadBookmark(forBrowser browserName: String) -> Data? {
        let defaults = UserDefaults.standard
        let key = bookmarkKeyFor(browserName)
        return defaults.data(forKey: key)
    }

}
