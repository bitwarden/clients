//
//  CredentialProviderViewController.swift
//  autofill-extension
//
//  Created by Andreas Coroiu on 2023-12-21.
//

import AuthenticationServices
import os

class CredentialProviderViewController: ASCredentialProviderViewController {
    let logger: Logger

    @IBOutlet weak var statusLabel: NSTextField!
    @IBOutlet weak var logoImageView: NSImageView!

    // The IPC client to communicate with the Bitwarden desktop app
    private var client: AutofillProviderClient?

    // Task for checking connection status
    private var connectionMonitorTask: Task<Void, Never>?
    private var lastConnectionStatus: ConnectionStatus = .disconnected

    // Correlation ID for the request currently being handled by the desktop app,
    // if any. Used to cancel that request when this view controller is torn down
    // before the request completes (e.g. the user dismisses the system UI).
    // Guarded by `requestLock` because host callbacks fire on foreign threads
    // while the view lifecycle runs on the main thread.
    private let requestLock = NSLock()
    // Safe to access off the main actor: every read and write below holds `requestLock`.
    private nonisolated(unsafe) var inFlightRequestContext: String?

    // Records that a request has been sent to the desktop app so that teardown
    // can cancel it if it hasn't completed yet.
    private nonisolated func beginRequest(_ context: String) {
        requestLock.lock()
        inFlightRequestContext = context
        requestLock.unlock()
    }

    // Marks the in-flight request as finished so teardown won't cancel it.
    // Called from the completion/error callbacks.
    private nonisolated func finishRequest() {
        requestLock.lock()
        inFlightRequestContext = nil
        requestLock.unlock()
    }

    // Atomically clears and returns the in-flight context, if any, so that the
    // caller can cancel it exactly once.
    private nonisolated func takeInFlightContext() -> String? {
        requestLock.lock()
        defer { requestLock.unlock() }
        let context = inFlightRequestContext
        inFlightRequestContext = nil
        return context
    }

    // We changed the getClient method to be async, here's why:
    // This is so that we can check if the app is running, and launch it, without blocking the main thread
    // Blocking the main thread caused MacOS layouting to 'fail' or at least be very delayed, which caused our getWindowPositioning code to sent 0,0.
    // We also properly retry the IPC connection which sometimes would take some time to be up and running, depending on CPU load, phase of jupiters moon, etc.
    private func getClient() async -> AutofillProviderClient {
        if let client = self.client {
            return client
        }

        initializeLogging()
        let logger = Logger(subsystem: "com.bitwarden.desktop.autofill-extension", category: "credential-provider")

        // Check if the Electron app is running
        let workspace = NSWorkspace.shared
        let isRunning = workspace.runningApplications.contains { app in
            app.bundleIdentifier == "com.bitwarden.desktop"
        }

        if !isRunning {
            logger.log("[autofill-extension] Bitwarden Desktop not running, attempting to launch")

            // Launch the app and wait for it to be ready
            if let appURL = workspace.urlForApplication(withBundleIdentifier: "com.bitwarden.desktop") {
                await withCheckedContinuation { continuation in
                    workspace.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration()) { app, error in
                        if let error = error {
                            logger.error("[autofill-extension] Failed to launch Bitwarden Desktop: \(error.localizedDescription)")
                        } else {
                            logger.log("[autofill-extension] Successfully launched Bitwarden Desktop")
                        }
                        continuation.resume()
                    }
                }
            }
        }

        logger.log("[autofill-extension] Connecting to Bitwarden over IPC")

        // Retry connecting to the Bitwarden IPC with an increasing delay
        let maxRetries = 20
        let delayMs = 500
        var newClient: AutofillProviderClient?

        for attempt in 1...maxRetries {
            logger.log("[autofill-extension] Connection attempt \(attempt)")

            // Create a new client instance for each retry
            newClient = AutofillProviderClient.connect()
            try? await Task.sleep(nanoseconds: UInt64(100 * attempt + (delayMs * 1_000_000))) // Convert ms to nanoseconds
            let connectionStatus = newClient!.getConnectionStatus()

            let statusString = switch connectionStatus {
                case .connecting: "connecting"
                case .connected: "connected"
                case .disconnected: "disconnected"
            }
            logger.log("[autofill-extension] Connection attempt \(attempt), status: \(statusString)")

            if connectionStatus == .connected {
                logger.log("[autofill-extension] Successfully connected to Bitwarden (attempt \(attempt))")
                break
            } else if connectionStatus == .connecting {
                // try to wait one more time while it's connecting
                try? await Task.sleep(for: .milliseconds(100))
                if newClient!.getConnectionStatus() == .connected {
                    break
                }
            }

            // client couldn't connect in deadline.
            if attempt < maxRetries {
                logger.log("[autofill-extension] Retrying connection")
            } else {
                logger.error("[autofill-extension] Failed to connect after \(maxRetries) attempts, final status: \(statusString)")
            }
        }

        self.client = newClient
        return newClient!
    }

    // Setup the connection monitoring task
    private func setupConnectionMonitoring() {
        // Initial check
        checkConnectionStatus()

        // Check connection status every 1 second
        connectionMonitorTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self else { return }
                self.checkConnectionStatus()
            }
        }
    }

    // Check the connection status by calling into Rust
    // If the connection is has changed and is now disconnected, cancel the request
    private func checkConnectionStatus() {
        // Only check connection status if the client has been initialized.
        // Initialization is done asynchronously, so we might be called before it's ready
        // In that case we just skip this check and wait for the next timer tick and re-check
        guard let client = self.client else {
            return
        }

        // Get the current connection status from Rust
        let currentStatus = client.getConnectionStatus()

        // Only post notification if state changed
        if currentStatus != lastConnectionStatus {
            if(currentStatus == .connected) {
                logger.log("[autofill-extension] Connection status changed: Connected")
            } else {
                logger.log("[autofill-extension] Connection status changed: Disconnected")
            }

            // Save the new status
            lastConnectionStatus = currentStatus

            // If we just disconnected, try to cancel the request
            if currentStatus == .disconnected {
                self.extensionContext.cancelRequest(withError: BitwardenError.Disconnected)
            }
        }
    }

    init() {
        logger = Logger(subsystem: "com.bitwarden.desktop.autofill-extension", category: "credential-provider")

        logger.log("[autofill-extension] initializing extension")

        super.init(nibName: "CredentialProviderViewController", bundle: nil)

        // Setup connection monitoring now that self is available
        setupConnectionMonitoring()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        logger.log("[autofill-extension] deinitializing extension")

        // Stop the connection monitor task
        connectionMonitorTask?.cancel()
    }

    private func getWindowDetails() async -> WindowDetails {
        let screenHeight = NSScreen.main?.frame.height ?? 1440

        logger.log("[autofill-extension] position: Getting window position")

        // To whomever is reading this. Sorry. But MacOS couldn't give us an accurate window positioning, possibly due to animations
        // So I added some retry logic, as well as a fall back to the mouse position which is likely at the sort of the right place.
        // In my testing we often succeed after 4-7 attempts.
        // Wait for window frame to stabilize (animation to complete)
        var lastFrame: CGRect = .zero
        var stableCount = 0
        let requiredStableChecks = 3
        let maxAttempts = 20
        var attempts = 0

        while stableCount < requiredStableChecks && attempts < maxAttempts {
            let currentFrame: CGRect = self.view.window?.frame ?? .zero

            if currentFrame.equalTo(lastFrame) && !currentFrame.equalTo(.zero) {
                stableCount += 1
            } else {
                stableCount = 0
                lastFrame = currentFrame
            }

            try? await Task.sleep(nanoseconds: 16_666_666) // ~60fps (16.67ms)
            attempts += 1
        }

        let x, y: Int32
        let finalWindowFrame = self.view.window?.frame ?? .zero
        logger.log("[autofill-extension] position: Final window frame: \(NSStringFromRect(finalWindowFrame))")

        // Use stabilized window frame if available, otherwise fallback to mouse position
        if finalWindowFrame.origin.x != 0 || finalWindowFrame.origin.y != 0 {
            let centerX = Int32(round(finalWindowFrame.origin.x))
            let centerY = Int32(round(screenHeight - finalWindowFrame.origin.y))
            logger.log("[autofill-extension] position: Using window position: x=\(centerX), y=\(centerY)")
            x = centerX
            y = centerY
        } else {
            // Fallback to mouse position
            let mouseLocation = NSEvent.mouseLocation
            let mouseX = Int32(round(mouseLocation.x))
            let mouseY = Int32(round(screenHeight - mouseLocation.y))
            logger.log("[autofill-extension] position: Using mouse position fallback: x=\(mouseX), y=\(mouseY)")
            x = mouseX
            y = mouseY
        }
        // Add 100 pixels to the x-coordinate to offset the native OS dialog positioning.
        return WindowDetails(position: Position(x: x + 100, y: y), handle: nil)
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Initially hide the view
        self.view.isHidden = true
    }

    // Notify the desktop app that an unfinished request should be cancelled. `takeInFlightContext()` returns
    // nil once a request has completed, so normal completion doesn't cancel.
    //
    // This method is called after `completeRequest` or `cancelRequest`, or if
    // the system UI is torn down when the user dismisses the sheet. Because of
    // that, this should be called at every terminal point in the extension's
    // flow.
    override func viewWillDisappear() {
        super.viewWillDisappear()

        if let context = takeInFlightContext() {
            logger.log("[autofill-extension] View disappearing with in-flight request, cancelling \(context)")
            self.client?.cancelRequest(context: context)
        }
    }

    override func prepareInterfaceForExtensionConfiguration() {
        // Show the configuration UI
        self.view.isHidden = false

        // Set the localized message
        statusLabel.stringValue = NSLocalizedString("autofillConfigurationMessage", comment: "Message shown when Bitwarden is enabled in system settings")

        // Send the native status request asynchronously
        Task {
            let client = await getClient()
            client.sendNativeStatus(key: "request-sync", value: "")
        }

        // Complete the configuration after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.extensionContext.completeExtensionConfigurationRequest()
        }
    }

    /*
     In order to implement this method, we need to query the state of the vault to be unlocked and have one and only one matching credential so that it doesn't need to show ui.
     If we do show UI, it's going to fail and disconnect after the platform timeout which is 3s.
     For now we just claim to always need UI displayed.
     */
    override func provideCredentialWithoutUserInteraction(for credentialRequest: any ASCredentialRequest) {
       let error = ASExtensionError(.userInteractionRequired)
       self.extensionContext.cancelRequest(withError: error)
       return
    }

    /*
     Implement this method if provideCredentialWithoutUserInteraction(for:) can fail with
     ASExtensionError.userInteractionRequired. In this case, the system may present your extension's
     UI and call this method. Show appropriate UI for authenticating the user then provide the password
     by completing the extension request with the associated ASPasswordCredential.
     */
    override func prepareInterfaceToProvideCredential(for credentialRequest: ASCredentialRequest) {
        let timeoutTimer = createTimer()
        if let request = credentialRequest as? ASPasskeyCredentialRequest {
            if let passkeyIdentity = request.credentialIdentity as? ASPasskeyCredentialIdentity {

                logger.log("[autofill-extension] prepareInterfaceToProvideCredential (passkey) called \(request)")

                let userVerification = UserVerification(request.userVerificationPreference)

                /*
                    We're still using the old request type here, because we're sending the same data, we're expecting a single credential to be used
                */
                Task {
                    let clientWindow = await self.getWindowDetails()
                    let context = UUID().uuidString
                    let req = PasskeyAssertionWithoutUserInterfaceRequest(
                        rpId: passkeyIdentity.relyingPartyIdentifier,
                        clientDataHash: request.clientDataHash,
                        userVerification: userVerification,
                        clientWindow: clientWindow,
                        credentialId: passkeyIdentity.credentialID,
                        userName: passkeyIdentity.userName,
                        userHandle: passkeyIdentity.userHandle,
                        recordIdentifier: passkeyIdentity.recordIdentifier,
                        context: context
                    )

                    let client = await getClient()
                    self.beginRequest(context)
                    client.preparePasskeyAssertionWithoutUserInterface(request: req, callback: AssertionCallback(self.hostRequest(timeoutTimer: timeoutTimer)))
                }
                return
            }
        }

        if let request = credentialRequest as? ASPasswordCredentialRequest {
            if let passwordIdentity = request.credentialIdentity as? ASPasswordCredentialIdentity {

                logger.log("[autofill-extension] prepareInterfaceToProvideCredential (password) called \(request)")

                let displayName: String? = if #available(macOS 26.2, *) {
                    passwordIdentity.serviceIdentifier.displayName
                } else {
                    nil
                }

                Task {
                    let context = UUID().uuidString
                    let req = PasswordAutofillRequest(
                        userName: passwordIdentity.user,
                        displayName: displayName,
                        serviceIdentifier: passwordIdentity.serviceIdentifier.identifier,
                        recordIdentifier: passwordIdentity.recordIdentifier,
                        context: context
                    )

                    let client = await getClient()
                    self.beginRequest(context)
                    client.preparePassword(request: req, callback: PasswordCallback(self.hostRequest(timeoutTimer: timeoutTimer)))
                }
                return
            }
        }

        timeoutTimer.cancel()

        logger.log("[autofill-extension] provideCredentialWithoutUserInteraction2 called wrong")
        self.extensionContext.cancelRequest(withError: BitwardenError.Internal("Invalid authentication request"))
    }

    private func createTimer() -> DispatchWorkItem {
        // Create a timer for 600 second timeout
        let timeoutTimer = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            logger.log("[autofill-extension] The operation timed out after 600 seconds")
            self.extensionContext.cancelRequest(withError: BitwardenError.Internal("The operation timed out"))
        }

        // Schedule the timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 600, execute: timeoutTimer)

        return timeoutTimer
    }

    override func prepareInterface(forPasskeyRegistration registrationRequest: ASCredentialRequest) {
        logger.log("[autofill-extension] prepareInterface")
        let timeoutTimer = createTimer()


        if let request = registrationRequest as? ASPasskeyCredentialRequest {
            if let passkeyIdentity = registrationRequest.credentialIdentity as? ASPasskeyCredentialIdentity {
                logger.log("[autofill-extension] prepareInterface(passkey) called \(request)")

                let userVerification = UserVerification(request.userVerificationPreference)

                // Convert excluded credentials to an array of credential IDs
                var excludedCredentialIds: [Data] = []
                if #available(macOSApplicationExtension 15.0, *) {
                    if let excludedCreds = request.excludedCredentials {
                        excludedCredentialIds = excludedCreds.map { $0.credentialID }
                    }
                }

                logger.log("[autofill-extension] prepareInterface(passkey) calling preparePasskeyRegistration")

                Task {
                    let clientWindow = await self.getWindowDetails()
                    let context = UUID().uuidString
                    let req = PasskeyRegistrationRequest(
                        rpId: passkeyIdentity.relyingPartyIdentifier,
                        clientDataHash: request.clientDataHash,
                        userVerification: userVerification,
                        clientWindow: clientWindow,
                        userName: passkeyIdentity.userName,
                        userHandle: passkeyIdentity.userHandle,
                        supportedAlgorithms: request.supportedAlgorithms.map{ Int32($0.rawValue) },
                        excludedCredentials: excludedCredentialIds,
                        context: context
                    )

                    let client = await getClient()
                    self.beginRequest(context)
                    client.preparePasskeyRegistration(request: req, callback: RegistrationCallback(self.hostRequest(timeoutTimer: timeoutTimer)))
                }
                return
            }
        }

        logger.log("[autofill-extension] We didn't get a passkey")

        timeoutTimer.cancel()
        // If we didn't get a passkey, return an error
        self.extensionContext.cancelRequest(withError: BitwardenError.Internal("Invalid registration request"))
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier], requestParameters: ASPasskeyCredentialRequestParameters) {
        logger.log("[autofill-extension] prepareCredentialList(passkey) for serviceIdentifiers: \(serviceIdentifiers.count)")

        let userVerification = UserVerification(requestParameters.userVerificationPreference)

        let timeoutTimer = createTimer()

        Task {
            let clientWindow = await self.getWindowDetails()
            let context = UUID().uuidString
            let req = PasskeyAssertionRequest(
                rpId: requestParameters.relyingPartyIdentifier,
                clientDataHash: requestParameters.clientDataHash,
                userVerification: userVerification,
                clientWindow: clientWindow,
                allowedCredentials: requestParameters.allowedCredentials,
                context: context
            )

            let client = await getClient()
            self.beginRequest(context)
            client.preparePasskeyAssertion(request: req, callback: AssertionCallback(self.hostRequest(timeoutTimer: timeoutTimer)))
        }
        return
    }

    // Bundles the state an IPC callback needs to settle the pending host request.
    private func hostRequest(timeoutTimer: DispatchWorkItem) -> HostRequest {
        HostRequest(
            ctx: self.extensionContext,
            logger: self.logger,
            timeoutTimer: timeoutTimer,
            onFinish: { [weak self] in self?.finishRequest() }
        )
    }
}

private extension UserVerification {
    init(_ preference: ASAuthorizationPublicKeyCredentialUserVerificationPreference) {
        self = switch preference {
        case .preferred: .preferred
        case .required: .required
        // TODO: We should default this to preferred to match WebAuthn.
        default: .discouraged
        }
    }
}

// A handle to the host request that is in flight, safe to settle from the IPC layer's threads.
//
// The generated UniFFI callback protocols require `Sendable`, but `ASCredentialProviderExtensionContext`
// and `DispatchWorkItem` are not so they are isolated to the main actor. `logger` and `onFinish` are
// `Sendable`, so they run immediately on the calling thread.
@MainActor
private final class HostRequest {
    private let ctx: ASCredentialProviderExtensionContext
    private let timeoutTimer: DispatchWorkItem
    private nonisolated let logger: Logger
    private nonisolated let onFinish: @Sendable () -> Void

    init(
        ctx: ASCredentialProviderExtensionContext,
        logger: Logger,
        timeoutTimer: DispatchWorkItem,
        onFinish: @escaping @Sendable () -> Void
    ) {
        self.ctx = ctx
        self.logger = logger
        self.timeoutTimer = timeoutTimer
        self.onFinish = onFinish
    }

    // Marks the request as no longer in flight, stops the timeout, then hands the extension
    // context to `settle` on the main actor.
    nonisolated func complete(
        _ settle: @escaping @Sendable @MainActor (ASCredentialProviderExtensionContext) -> Void
    ) {
        onFinish()
        Task { @MainActor in
            self.timeoutTimer.cancel()
            settle(self.ctx)
        }
    }

    nonisolated func cancel(with error: BitwardenError) {
        logger.error("[autofill-extension] OnError called, cancelling the request \(error)")
        complete { $0.cancelRequest(withError: error) }
    }
}

// Forwards a passkey assertion result from the IPC layer to the host request.
private final class AssertionCallback: PreparePasskeyAssertionCallback {
    private let request: HostRequest

    init(_ request: HostRequest) {
        self.request = request
    }

    func onComplete(credential: PasskeyAssertionResponse) {
        request.complete { ctx in
            ctx.completeAssertionRequest(using: ASPasskeyAssertionCredential(
                userHandle: credential.userHandle,
                relyingParty: credential.rpId,
                signature: credential.signature,
                clientDataHash: credential.clientDataHash,
                authenticatorData: credential.authenticatorData,
                credentialID: credential.credentialId
            ))
        }
    }

    func onError(error: BitwardenError) {
        request.cancel(with: error)
    }
}

// Forwards a passkey registration result from the IPC layer to the host request.
private final class RegistrationCallback: PreparePasskeyRegistrationCallback {
    private let request: HostRequest

    init(_ request: HostRequest) {
        self.request = request
    }

    func onComplete(credential: PasskeyRegistrationResponse) {
        request.complete { ctx in
            ctx.completeRegistrationRequest(using: ASPasskeyRegistrationCredential(
                relyingParty: credential.rpId,
                clientDataHash: credential.clientDataHash,
                credentialID: credential.credentialId,
                attestationObject: credential.attestationObject
            ))
        }
    }

    func onError(error: BitwardenError) {
        request.cancel(with: error)
    }
}

// Forwards a password autofill result from the IPC layer to the host request.
private final class PasswordCallback: PreparePasswordAutofillCallback {
    private let request: HostRequest

    init(_ request: HostRequest) {
        self.request = request
    }

    func onComplete(credential: PasswordAutofillResponse) {
        request.complete { ctx in
            ctx.completeRequest(withSelectedCredential: ASPasswordCredential(
                user: credential.username,
                password: credential.password
            ))
        }
    }

    func onError(error: BitwardenError) {
        request.cancel(with: error)
    }
}
