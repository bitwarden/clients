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
    
    // There is something a bit strange about the initialization/deinitialization in this class.
    // Sometimes deinit won't be called after a request has successfully finished,
    // which would leave this class hanging in memory and the IPC connection open.
    //
    // If instead I make this a static, the deinit gets called correctly after each request.
    // I think we still might want a static regardless, to be able to reuse the connection if possible.
    let client: MacOsProviderClient = {
        let logger = Logger(subsystem: "com.bitwarden.desktop.autofill-extension", category: "credential-provider")
        
        // Check if the Electron app is running
        let workspace = NSWorkspace.shared
        let isRunning = workspace.runningApplications.contains { app in
            app.bundleIdentifier == "com.bitwarden.desktop"
        }
        
        if !isRunning {
           logger.log("[autofill-extension] Bitwarden Desktop not running, attempting to launch")
            
           // Try to launch the app
            if let appURL = workspace.urlForApplication(withBundleIdentifier: "com.bitwarden.desktop") {
                let semaphore = DispatchSemaphore(value: 0)
                
                workspace.openApplication(at: appURL,
                                          configuration: NSWorkspace.OpenConfiguration()) { app, error in
                    if let error = error {
                        logger.error("[autofill-extension] Failed to launch Bitwarden Desktop: \(error.localizedDescription)")
                    } else if let app = app {
                        logger.log("[autofill-extension] Successfully launched Bitwarden Desktop")
                    } else {
                        logger.error("[autofill-extension] Failed to launch Bitwarden Desktop: unknown error")
                    }
                    semaphore.signal()
                }
                
                // Wait for launch completion with timeout
                _ = semaphore.wait(timeout: .now() + 5.0)
                
                // Add a small delay to allow for initialization
                Thread.sleep(forTimeInterval: 1.0)
            } else {
                logger.error("[autofill-extension] Could not find Bitwarden Desktop app")
            }
        } else {
            logger.log("[autofill-extension] Bitwarden Desktop is running")    
        }
        
        logger.log("[autofill-extension] Connecting to Bitwarden over IPC")    

        return MacOsProviderClient.connect()
    }()
    
    // Timer for checking connection status
    private var connectionMonitorTimer: Timer?
    private var lastConnectionStatus: ConnectionStatus = .disconnected
    
    // Setup the connection monitoring timer
    private func setupConnectionMonitoring() {
        // Check connection status every 1 second
        connectionMonitorTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.checkConnectionStatus()
        }
        
        // Make sure timer runs even when UI is busy
        RunLoop.current.add(connectionMonitorTimer!, forMode: .common)
        
        // Initial check
        checkConnectionStatus()
    }
    
    // Check the connection status by calling into Rust
    private func checkConnectionStatus() {
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
                self.extensionContext.cancelRequest(withError: BitwardenError.Internal("Bitwarden desktop app disconnected"))
            }
        }
    }
    
    init() {
        logger = Logger(subsystem: "com.bitwarden.desktop.autofill-extension", category: "credential-provider")
        
        logger.log("[autofill-extension] initializing extension")
        
        super.init(nibName: nil, bundle: nil)
        
        // Setup connection monitoring now that self is available
        setupConnectionMonitoring()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    deinit {
        logger.log("[autofill-extension] deinitializing extension")
        
        // Stop the connection monitor timer
        connectionMonitorTimer?.invalidate()
        connectionMonitorTimer = nil
    }
    
    
    @IBAction func cancel(_ sender: AnyObject?) {
        self.extensionContext.cancelRequest(withError: NSError(domain: ASExtensionErrorDomain, code: ASExtensionError.userCanceled.rawValue))
    }
    
    @IBAction func passwordSelected(_ sender: AnyObject?) {
        let passwordCredential = ASPasswordCredential(user: "j_appleseed", password: "apple1234")
        self.extensionContext.completeRequest(withSelectedCredential: passwordCredential, completionHandler: nil)
    }
    
    private func getWindowPosition() -> Position {
        let frame = self.view.window?.frame ?? .zero
        let screenHeight = NSScreen.main?.frame.height ?? 0
        let screenWidth = NSScreen.main?.frame.width ?? 0

        // frame.width and frame.height is always 0. Estimating works OK for now.
        let estimatedWidth:CGFloat = 400;
        let estimatedHeight:CGFloat = 200;
        // passkey modals are 600x600.
        let modalHeight: CGFloat = 600;
        let modalWidth: CGFloat = 600;
        let centerX = round(frame.origin.x + estimatedWidth/2)
        let centerY = round(screenHeight - (frame.origin.y + estimatedHeight/2))
        // Check if centerX or centerY are beyond either edge of the screen.  If they are find the center of the screen, otherwise use the original value.
        let positionX = centerX + modalWidth >= screenWidth || CGFloat(centerX) - modalWidth <= 0 ? Int32(screenWidth/2) : Int32(centerX)
        let positionY = centerY + modalHeight >= screenHeight || CGFloat(centerY) - modalHeight <= 0 ? Int32(screenHeight/2) : Int32(centerY)
        return Position(x: positionX, y: positionY)
    }
    
    override func loadView() {
        let view = NSView()
        // Hide the native window since we only need the IPC connection
        view.isHidden = true    
        self.view = view
    }
    
    override func prepareInterfaceForExtensionConfiguration() {
        client.sendNativeStatus(key: "request-sync", value: "")
        self.extensionContext.completeExtensionConfigurationRequest()
    }
       
    override func provideCredentialWithoutUserInteraction(for credentialRequest: any ASCredentialRequest) {
        let timeoutTimer = createTimer()

        if let request = credentialRequest as? ASPasskeyCredentialRequest {
            if let passkeyIdentity = request.credentialIdentity as? ASPasskeyCredentialIdentity {
                
                logger.log("[autofill-extension] provideCredentialWithoutUserInteraction2(passkey) called \(request)")
                
                class CallbackImpl: PreparePasskeyAssertionCallback {
                    let ctx: ASCredentialProviderExtensionContext
                    let logger: Logger
                    let timeoutTimer: DispatchWorkItem
                    required init(_ ctx: ASCredentialProviderExtensionContext,_ logger: Logger, _ timeoutTimer: DispatchWorkItem) {
                        self.ctx = ctx
                        self.logger = logger
                        self.timeoutTimer = timeoutTimer
                    }
                    
                    func onComplete(credential: PasskeyAssertionResponse) {
                        self.timeoutTimer.cancel()
                        ctx.completeAssertionRequest(using: ASPasskeyAssertionCredential(
                            userHandle: credential.userHandle,
                            relyingParty: credential.rpId,
                            signature: credential.signature,
                            clientDataHash: credential.clientDataHash,
                            authenticatorData: credential.authenticatorData,
                            credentialID: credential.credentialId
                        ))
                    }
                    
                    func onError(error: BitwardenError) {
                        logger.error("[autofill-extension] OnError called, cancelling the request \(error)")
                        self.timeoutTimer.cancel()
                        ctx.cancelRequest(withError: error)
                    }
                }
                
                let userVerification = switch request.userVerificationPreference {
                case .preferred:
                    UserVerification.preferred
                case .required:
                    UserVerification.required
                default:
                    UserVerification.discouraged
                }
                
                let req = PasskeyAssertionWithoutUserInterfaceRequest(
                    rpId: passkeyIdentity.relyingPartyIdentifier,
                    credentialId: passkeyIdentity.credentialID,
                    userName: passkeyIdentity.userName,
                    userHandle: passkeyIdentity.userHandle,
                    recordIdentifier: passkeyIdentity.recordIdentifier,
                    clientDataHash: request.clientDataHash,
                    userVerification: userVerification,
                    windowXy: self.getWindowPosition()
                )
                
                self.client.preparePasskeyAssertionWithoutUserInterface(request: req, callback: CallbackImpl(self.extensionContext, self.logger, timeoutTimer))
                return
            }
        }
        
        timeoutTimer.cancel()
        
        logger.log("[autofill-extension] provideCredentialWithoutUserInteraction2 called wrong")
        self.extensionContext.cancelRequest(withError: BitwardenError.Internal("Invalid authentication request"))
    }
    
    /*
     Implement this method if provideCredentialWithoutUserInteraction(for:) can fail with
     ASExtensionError.userInteractionRequired. In this case, the system may present your extension's
     UI and call this method. Show appropriate UI for authenticating the user then provide the password
     by completing the extension request with the associated ASPasswordCredential.
     
     override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
     }
     */

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
                
                class CallbackImpl: PreparePasskeyRegistrationCallback {
                    let ctx: ASCredentialProviderExtensionContext
                    let timeoutTimer: DispatchWorkItem
                    let logger: Logger
                    
                    required init(_ ctx: ASCredentialProviderExtensionContext, _ logger: Logger,_ timeoutTimer: DispatchWorkItem) {
                        self.ctx = ctx
                        self.logger = logger
                        self.timeoutTimer = timeoutTimer
                    }
                    
                    func onComplete(credential: PasskeyRegistrationResponse) {
                        self.timeoutTimer.cancel()
                        ctx.completeRegistrationRequest(using: ASPasskeyRegistrationCredential(
                            relyingParty: credential.rpId,
                            clientDataHash: credential.clientDataHash,
                            credentialID: credential.credentialId,
                            attestationObject: credential.attestationObject
                        ))
                    }
                    
                    func onError(error: BitwardenError) {
                        logger.error("[autofill-extension] OnError called, cancelling the request \(error)")
                        self.timeoutTimer.cancel()
                        ctx.cancelRequest(withError: error)
                    }
                }
                
                let userVerification = switch request.userVerificationPreference {
                case .preferred:
                    UserVerification.preferred
                case .required:
                    UserVerification.required
                default:
                    UserVerification.discouraged
                }
                
                // Convert excluded credentials to an array of credential IDs
                var excludedCredentialIds: [Data] = []
                if #available(macOSApplicationExtension 15.0, *) {
                    if let excludedCreds = request.excludedCredentials {
                        excludedCredentialIds = excludedCreds.map { $0.credentialID }
                    }
                }
                
                let req = PasskeyRegistrationRequest(
                    rpId: passkeyIdentity.relyingPartyIdentifier,
                    userName: passkeyIdentity.userName,
                    userHandle: passkeyIdentity.userHandle,
                    clientDataHash: request.clientDataHash,
                    userVerification: userVerification,
                    supportedAlgorithms: request.supportedAlgorithms.map{ Int32($0.rawValue) },
                    windowXy: self.getWindowPosition(),
                    excludedCredentials: excludedCredentialIds
                )
                logger.log("[autofill-extension] prepareInterface(passkey) calling preparePasskeyRegistration")                
                
                self.client.preparePasskeyRegistration(request: req, callback: CallbackImpl(self.extensionContext, self.logger, timeoutTimer))
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
                               
        class CallbackImpl: PreparePasskeyAssertionCallback {
            let ctx: ASCredentialProviderExtensionContext
            let timeoutTimer: DispatchWorkItem
            let logger: Logger
            required init(_ ctx: ASCredentialProviderExtensionContext,_ logger: Logger, _ timeoutTimer: DispatchWorkItem) {
                self.ctx = ctx
                self.logger = logger
                self.timeoutTimer = timeoutTimer
            }
            
            func onComplete(credential: PasskeyAssertionResponse) {
                self.timeoutTimer.cancel()
                ctx.completeAssertionRequest(using: ASPasskeyAssertionCredential(
                    userHandle: credential.userHandle,
                    relyingParty: credential.rpId,
                    signature: credential.signature,
                    clientDataHash: credential.clientDataHash,
                    authenticatorData: credential.authenticatorData,
                    credentialID: credential.credentialId
                ))
            }
            
            func onError(error: BitwardenError) {
                logger.error("[autofill-extension] OnError called, cancelling the request \(error)")
                self.timeoutTimer.cancel()
                ctx.cancelRequest(withError: error)
            }
        }
        
        let userVerification = switch requestParameters.userVerificationPreference {
        case .preferred:
            UserVerification.preferred
        case .required:
            UserVerification.required
        default:
            UserVerification.discouraged
        }
        
        let req = PasskeyAssertionRequest(
            rpId: requestParameters.relyingPartyIdentifier,
            clientDataHash: requestParameters.clientDataHash,
            userVerification: userVerification,
            allowedCredentials: requestParameters.allowedCredentials,
            windowXy: self.getWindowPosition()
            //extensionInput: requestParameters.extensionInput,
        )
        
        let timeoutTimer = createTimer()
        
        self.client.preparePasskeyAssertion(request: req, callback: CallbackImpl(self.extensionContext, self.logger, timeoutTimer))
        return
    }    
}
