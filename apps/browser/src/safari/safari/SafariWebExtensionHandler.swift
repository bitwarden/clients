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
