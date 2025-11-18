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
        guard let relativePath = browserPaths[browserName] else {
            NSLog("Unknown browser: \(browserName)")
            return nil
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let browserPath = homeDir.appendingPathComponent(relativePath)

        // Open file picker at home directory and provide instructions to grant access to browserPath
        // Mac OS will automatically request permission to access this location from the sandbox when the location is selected here
        let openPanel = NSOpenPanel()
        openPanel.message =
            "Please select your \(browserName) data folder\n\nExpected location:\n\(browserPath.path)"
        openPanel.prompt = "Grant Access"
        openPanel.allowsMultipleSelection = false
        openPanel.canChooseDirectories = true
        openPanel.canChooseFiles = false
        openPanel.directoryURL = browserPath.deletingLastPathComponent()  // home directory

        guard openPanel.runModal() == .OK, let url = openPanel.url else {
            NSLog("User cancelled access request")
            return nil
        }

        let localStatePath = url.appendingPathComponent("Local State")
        guard FileManager.default.fileExists(atPath: localStatePath.path) else {
            NSLog("Selected folder doesn't appear to be a valid \(browserName) directory")

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
            return bookmarkData.base64EncodedString()
        } catch {
            NSLog("Failed to create bookmark: \(error)")
            return nil
        }
    }

    /// Check if we have stored bookmark for browser (doesn't verify it's still valid)
    @objc public func hasStoredAccess(_ browserName: String) -> Bool {
        return loadBookmark(forBrowser: browserName) != nil
    }

    /// Start accessing a browser directory using stored bookmark
    /// Returns the resolved path, or nil if bookmark is invalid/revoked
    /*
    This could return nil if:
        The user  doesn’t have access to this URL
        The URL isn’t a security scoped URL
T       The directory doesn’t need it (~/Downloads)

    https://benscheirman.com/2019/10/troubleshooting-appkit-file-permissions.html
    */
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
                NSLog("Security bookmark for \(browserName) is stale, attempting to re-create it")
                do {
                    let newBookmarkData = try url.bookmarkData(
                        options: .withSecurityScope,
                        includingResourceValuesForKeys: nil,
                        relativeTo: nil
                    )

                    saveBookmark(newBookmarkData, forBrowser: browserName)
                } catch {
                    NSLog("Failed to create bookmark: \(error)")
                    return nil
                }
            }

            guard url.startAccessingSecurityScopedResource() else {
                NSLog("Failed to start accessing security-scoped resource")
                return nil
            }

            return url.path
        } catch {
            NSLog("Failed to resolve bookmark: \(error)")
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
            NSLog("Failed to resolve bookmark for stop: \(error)")
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
