import SafariServices
import os.log
import LocalAuthentication

let SFExtensionMessageKey = "message"
let ServiceName = "Bitwarden"
let ServiceNameBiometric = ServiceName + "_biometric"

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    override init() {
        super.init();
        NSApplication.shared.setActivationPolicy(.accessory)
    }

	func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey] as AnyObject?
        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@", message as! CVarArg)

        let response = NSExtensionItem()

        guard let command = message?["command"] as? String else {
            return
        }

        switch (command) {
        case "readFromClipboard":
            let pasteboard = NSPasteboard.general
            response.userInfo = [ SFExtensionMessageKey: pasteboard.pasteboardItems?.first?.string(forType: .string) as Any ]
            break
        case "copyToClipboard":
            guard let msg = message?["data"] as? String else {
                return
            }
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(msg, forType: .string)
        case "showPopover":
            SFSafariApplication.getActiveWindow { win in
                win?.getToolbarItem(completionHandler: { item in
                    item?.showPopover()
                })
            }
            break
        case "downloadFile":
            guard let jsonData = message?["data"] as? String else {
                return
            }
            guard let dlMsg: DownloadFileMessage = jsonDeserialize(json: jsonData) else {
                return
            }
            var blobData: Data?
            if dlMsg.blobOptions?.type == "text/plain" {
                blobData = dlMsg.blobData?.data(using: .utf8)
            } else if let blob = dlMsg.blobData {
                blobData = Data(base64Encoded: blob)
            }
            guard let data = blobData else {
                return
            }

            let panel = NSSavePanel()
            panel.canCreateDirectories = true
            panel.nameFieldStringValue = dlMsg.fileName
            let response = panel.runModal();

            if response == NSApplication.ModalResponse.OK {
                if let url = panel.url {
                    do {
                        let fileManager = FileManager.default
                        if !fileManager.fileExists(atPath: url.path) {
                            fileManager.createFile(atPath: url.path, contents: Data(),
                                                   attributes: nil)
                        }
                        try data.write(to: url)
                    } catch {
                        print(error)
                        NSLog("ERROR in downloadFile, \(error)")
                    }
                }
            }
            break
        case "sleep":
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        // Deprecated
        case "authenticateWithBiometrics":
            let messageId = message?["messageId"] as? Int
            let laContext = LAContext()
            guard let accessControl = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil) else {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "authenticateWithBiometrics",
                            "response": false,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]
                break
            }
            laContext.evaluateAccessControl(accessControl, operation: .useKeySign, localizedReason: "authenticate") { (success, error) in
                if success {
                    response.userInfo = [ SFExtensionMessageKey: [
                        "message": [
                            "command": "authenticateWithBiometrics",
                            "response": true,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ]]
                } else {
                    response.userInfo = [ SFExtensionMessageKey: [
                        "message": [
                            "command": "authenticateWithBiometrics",
                            "response": false,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ]]
                }

                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        // Deprecated
        case "getBiometricsStatus":
            let messageId = message?["messageId"] as? Int
            response.userInfo = [
                SFExtensionMessageKey: [
                    "message": [
                        "command": "getBiometricsStatus",
                        "response": BiometricsStatus.Available.rawValue,
                        "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                        "messageId": messageId,
                    ],
                ],
            ]

            context.completeRequest(returningItems: [response], completionHandler: nil);
            break
        // Deprecated
        case "unlockWithBiometricsForUser":
            let messageId = message?["messageId"] as? Int
            var error: NSError?
            let laContext = LAContext()

            laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

            if let e = error, e.code != kLAErrorBiometryLockout {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "unlockWithBiometricsForUser",
                            "response": false,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]

                context.completeRequest(returningItems: [response], completionHandler: nil)
                break
            }

            var flags: SecAccessControlCreateFlags = [.privateKeyUsage];
            // https://developer.apple.com/documentation/security/secaccesscontrolcreateflags/biometryany
            if #available(macOS 10.13.4, *) {
                flags.insert(.biometryAny)
            } else {
                flags.insert(.touchIDAny)
            }

            guard let accessControl = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, nil) else {
                let messageId = message?["messageId"] as? Int
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "unlockWithBiometricsForUser",
                            "response": false,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]

                context.completeRequest(returningItems: [response], completionHandler: nil)
                break
            }
            laContext.evaluateAccessControl(accessControl, operation: .useKeySign, localizedReason: "unlock your vault") { (success, error) in
                if success {
                    guard let userId = message?["userId"] as? String else {
                        return
                    }
                    let passwordName = userId + "_user_biometric"
                    var passwordLength: UInt32 = 0
                    var passwordPtr: UnsafeMutableRawPointer? = nil

                    var status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(passwordName.utf8.count), passwordName, &passwordLength, &passwordPtr, nil)
                    if status != errSecSuccess {
                        let fallbackName = "key"
                        status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(fallbackName.utf8.count), fallbackName, &passwordLength, &passwordPtr, nil)
                    }

                    if status == errSecSuccess {
                        let result = NSString(bytes: passwordPtr!, length: Int(passwordLength), encoding: String.Encoding.utf8.rawValue) as String?
                                    SecKeychainItemFreeContent(nil, passwordPtr)

                        response.userInfo = [ SFExtensionMessageKey: [
                            "message": [
                                "command": "unlockWithBiometricsForUser",
                                "response": true,
                                "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                                "userKeyB64": result!.replacingOccurrences(of: "\"", with: ""),
                                "messageId": messageId,
                            ],
                        ]]
                    } else {
                        response.userInfo = [
                            SFExtensionMessageKey: [
                                "message": [
                                    "command": "unlockWithBiometricsForUser",
                                    "response": true,
                                    "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                                    "messageId": messageId,
                                ],
                            ],
                        ]
                    }
                }

                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        // Deprecated
        case "getBiometricsStatusForUser":
            let messageId = message?["messageId"] as? Int
            let laContext = LAContext()
            if !laContext.isBiometricsAvailable() {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "getBiometricsStatusForUser",
                            "response": BiometricsStatus.HardwareUnavailable.rawValue,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]

                context.completeRequest(returningItems: [response], completionHandler: nil)
                break
            }

            guard let userId = message?["userId"] as? String else {
                return
            }
            let passwordName = userId + "_user_biometric"
            var passwordLength: UInt32 = 0
            var passwordPtr: UnsafeMutableRawPointer? = nil

            var status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(passwordName.utf8.count), passwordName, &passwordLength, &passwordPtr, nil)
            if status != errSecSuccess {
                let fallbackName = "key"
                status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(fallbackName.utf8.count), fallbackName, &passwordLength, &passwordPtr, nil)
            }

            if status == errSecSuccess {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "getBiometricsStatusForUser",
                            "response": BiometricsStatus.Available.rawValue,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]
            } else {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "getBiometricsStatusForUser",
                            "response": BiometricsStatus.NotEnabledInConnectedDesktopApp.rawValue,
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                            "messageId": messageId,
                        ],
                    ],
                ]
            }
            break
        // Deprecated
        case "biometricUnlock":
            var error: NSError?
            let laContext = LAContext()

            if(!laContext.isBiometricsAvailable()){
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "biometricUnlock",
                            "response": "not supported",
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                        ],
                    ],
                ]
                break
            }

            guard let accessControl = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil) else {
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "message": [
                            "command": "biometricUnlock",
                            "response": "not supported",
                            "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                        ],
                    ],
                ]
                break
            }
            laContext.evaluateAccessControl(accessControl, operation: .useKeySign, localizedReason: "Biometric Unlock") { (success, error) in
                if success {
                    guard let userId = message?["userId"] as? String else {
                        return
                    }
                    let passwordName = userId + "_user_biometric"
                    var passwordLength: UInt32 = 0
                    var passwordPtr: UnsafeMutableRawPointer? = nil

                    var status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(passwordName.utf8.count), passwordName, &passwordLength, &passwordPtr, nil)
                    if status != errSecSuccess {
                        let fallbackName = "key"
                        status = SecKeychainFindGenericPassword(nil, UInt32(ServiceNameBiometric.utf8.count), ServiceNameBiometric, UInt32(fallbackName.utf8.count), fallbackName, &passwordLength, &passwordPtr, nil)
                    }

                    if status == errSecSuccess {
                        let result = NSString(bytes: passwordPtr!, length: Int(passwordLength), encoding: String.Encoding.utf8.rawValue) as String?
                                    SecKeychainItemFreeContent(nil, passwordPtr)

                        response.userInfo = [ SFExtensionMessageKey: [
                            "message": [
                                "command": "biometricUnlock",
                                "response": "unlocked",
                                "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                                "userKeyB64": result!.replacingOccurrences(of: "\"", with: ""),
                            ],
                        ]]
                    } else {
                        response.userInfo = [
                            SFExtensionMessageKey: [
                                "message": [
                                    "command": "biometricUnlock",
                                    "response": "not enabled",
                                    "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                                ],
                            ],
                        ]
                    }
                }

                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        // Deprecated
        case "biometricUnlockAvailable":
            let laContext = LAContext()
            var isAvailable = laContext.isBiometricsAvailable();

            response.userInfo = [
                SFExtensionMessageKey: [
                    "message": [
                        "command": "biometricUnlockAvailable",
                        "response": isAvailable ? "available" : "not available",
                        "timestamp": Int64(NSDate().timeIntervalSince1970 * 1000),
                    ],
                ],
            ]
            break
        // IPC to safari works via two primitives, send message, receive messages.
        // The desktop app buffers messages to receive, and accepts messages the safari extension sends it.
        case "sendMessage":
            // Transport verb: forward an extension -> desktop payload to the buffered desktop
            // socket.
            let payloadString = message?["data"] as? String ?? ""
            DispatchQueue.global(qos: .userInitiated).async {
                var ok = false
                let request: [String: Any] = ["op": "send", "payload": payloadString]
                if let requestData = try? JSONSerialization.data(withJSONObject: request),
                   let responseData = BufferedSocketClient.sendRequest(requestData),
                   let parsed = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any] {
                    ok = parsed["ok"] as? Bool ?? false
                }
                response.userInfo = [ SFExtensionMessageKey: [ "ok": ok ] ]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        case "receiveMessage":
            // Transport verb: drain buffered desktop -> extension messages by polling.
            DispatchQueue.global(qos: .userInitiated).async {
                var messages: [String] = []
                let request: [String: Any] = ["op": "receive"]
                if let requestData = try? JSONSerialization.data(withJSONObject: request),
                   let responseData = BufferedSocketClient.sendRequest(requestData),
                   let parsed = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                   let msgs = parsed["messages"] as? [String] {
                    messages = msgs
                }
                response.userInfo = [ SFExtensionMessageKey: [ "messages": messages ] ]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        default:
            return
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}

func jsonSerialize<T: Encodable>(obj: T?) -> String? {
    let encoder = JSONEncoder()
    do {
        let data = try encoder.encode(obj)
        return String(data: data, encoding: .utf8) ?? "null"
    } catch _ {
        return "null"
    }
}

func jsonDeserialize<T: Decodable>(json: String?) -> T? {
    if json == nil {
        return nil
    }
    let decoder = JSONDecoder()
    do {
        let obj = try decoder.decode(T.self, from: json!.data(using: .utf8)!)
        return obj
    } catch _ {
        return nil
    }
}

/// Client for the desktop app's buffered Safari IPC socket.
///
/// The socket lives in the shared App Group container so this sandboxed extension can reach it.
/// Frames are length-delimited with a 4-byte little-endian length prefix, matching the desktop's
/// `LengthDelimitedCodec`.
enum BufferedSocketClient {
    /// Shared App Group identifier; must match the desktop app, the desktop proxy, and the Rust
    /// `app_group_path` helper.
    static let appGroupId = "LTZ2PFU5D6.com.bitwarden.desktop"
    /// Socket endpoint name; must match the desktop's `NativeBufferedIpcServer.listen` name.
    static let socketName = "s.bw-safari"
    /// Maximum frame size, matching the desktop's `NATIVE_MESSAGING_BUFFER_SIZE`.
    static let maxFrameLength = 1024 * 1024

    /// Resolve the socket path inside the shared App Group container.
    static func socketPath() -> String? {
        guard let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            os_log(.error, "[BufferedSocketClient] App Group container URL is nil for group %{public}@ — is the app group entitlement provisioned for the extension?", appGroupId)
            return nil
        }
        return container.appendingPathComponent(socketName).path
    }

    /// Send one length-delimited request and return the response payload. Blocking; call off the
    /// main thread. Returns `nil` on any connection or protocol error.
    static func sendRequest(_ payload: Data) -> Data? {
        guard let path = socketPath() else { return nil }
        guard payload.count <= maxFrameLength else {
            return nil
        }

        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        if fd < 0 {
            return nil
        }
        defer { close(fd) }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let pathBytes = path.utf8CString
        // sun_path is a fixed-size buffer (104 bytes on Darwin); the path must fit including its
        // null terminator.
        if pathBytes.count > MemoryLayout.size(ofValue: addr.sun_path) {
            os_log(.error, "[BufferedSocketClient] Socket path too long (%d bytes, max %d)", pathBytes.count, MemoryLayout.size(ofValue: addr.sun_path))
            return nil
        }
        withUnsafeMutablePointer(to: &addr.sun_path) { rawPtr in
            rawPtr.withMemoryRebound(to: CChar.self, capacity: pathBytes.count) { dst in
                pathBytes.withUnsafeBufferPointer { src in
                    dst.update(from: src.baseAddress!, count: pathBytes.count)
                }
            }
        }

        let connected = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        if connected < 0 {
            os_log(.error, "[BufferedSocketClient] connect() failed: errno %d (%{public}@) — is the desktop app running and listening at this path?", errno, String(cString: strerror(errno)))
            return nil
        }
        os_log(.default, "[BufferedSocketClient] Connected successfully")

        // Write the 4-byte little-endian length prefix followed by the payload.
        let length = UInt32(payload.count)
        let header = Data([
            UInt8(length & 0xff),
            UInt8((length >> 8) & 0xff),
            UInt8((length >> 16) & 0xff),
            UInt8((length >> 24) & 0xff),
        ])
        if !writeAll(fd, header) || !writeAll(fd, payload) { return nil }

        // Read the response length prefix, then exactly that many bytes.
        guard let lengthData = readExactly(fd, 4) else { return nil }
        let lengthBytes = [UInt8](lengthData)
        let responseLength = UInt32(lengthBytes[0])
            | (UInt32(lengthBytes[1]) << 8)
            | (UInt32(lengthBytes[2]) << 16)
            | (UInt32(lengthBytes[3]) << 24)
        if responseLength > UInt32(maxFrameLength) { return nil }
        return readExactly(fd, Int(responseLength))
    }

    private static func writeAll(_ fd: Int32, _ data: Data) -> Bool {
        // closeOnDealloc: false — the caller owns `fd` and closes it via `defer`.
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        do {
            // write(contentsOf:) handles partial writes internally.
            try handle.write(contentsOf: data)
            return true
        } catch {
            return false
        }
    }

    private static func readExactly(_ fd: Int32, _ count: Int) -> Data? {
        if count == 0 { return Data() }
        // closeOnDealloc: false — the caller owns `fd` and closes it via `defer`.
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        var buffer = Data()
        while buffer.count < count {
            // read(upToCount:) may return fewer bytes than requested; loop until we have `count`.
            guard let chunk = try? handle.read(upToCount: count - buffer.count),
                  !chunk.isEmpty else {
                return nil
            }
            buffer.append(chunk)
        }
        return buffer
    }
}

extension LAContext {
    func isBiometricsAvailable() -> Bool {
        var error: NSError?

        self.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if let e = error, e.code != kLAErrorBiometryLockout {
            return false;
        } else {
            return true;
        }
    }
}

class DownloadFileMessage: Decodable, Encodable {
    var fileName: String
    var blobData: String?
    var blobOptions: DownloadFileMessageBlobOptions?
}

class DownloadFileMessageBlobOptions: Decodable, Encodable {
    var type: String?
}

enum BiometricsStatus : Int {
    case Available = 0
    case UnlockNeeded = 1
    case HardwareUnavailable = 2
    case AutoSetupNeeded = 3
    case ManualSetupNeeded = 4
    case PlatformUnsupported = 5
    case DesktopDisconnected = 6
    case NotEnabledLocally = 7
    case NotEnabledInConnectedDesktopApp = 8
}
