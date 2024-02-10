import LocalAuthentication
import SwiftRs

@_cdecl("biometric_available")
func available() -> Bool {
    let laContext = LAContext()
    var error: NSError?

    let canEvaluatePolicy = laContext.canEvaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        error: &error
    )
    
    // Check if there's an error and if it's not the biometry lockout error.
    if let e = error, e.code != kLAErrorBiometryLockout {
        return false
    }
    
    return canEvaluatePolicy
}

@_cdecl("biometric_evaluateAccessControl")
func evaluateAccessControl(reason: SRString) -> Bool {
    let reason = reason.toString()
    let semaphore = DispatchSemaphore(value: 0)
    var didEvaluate = false
    
    var error: NSError?
    let laContext = LAContext()
    laContext.localizedFallbackTitle = ""

    laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

    if let e = error, e.code != kLAErrorBiometryLockout {
        return didEvaluate
    }
    
    var flags: SecAccessControlCreateFlags = [.privateKeyUsage];
    if #available(macOS 10.13.4, *) {
        flags.insert(.biometryAny)
    } else {
        flags.insert(.touchIDAny)
    }

    guard let accessControl = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, nil) else {
        return didEvaluate
    }
    laContext.evaluateAccessControl(accessControl, operation: .useKeySign, localizedReason: reason) { (success, error) in
        didEvaluate = success
        semaphore.signal()
    }

    semaphore.wait()
    return didEvaluate
}
