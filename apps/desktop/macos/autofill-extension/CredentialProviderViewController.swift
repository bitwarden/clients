//
//  CredentialProviderViewController.swift
//  autofill-extension
//
//  Created by Andreas Coroiu on 2023-12-21.
//

import AuthenticationServices
import os

class CredentialProviderViewController: ASCredentialProviderViewController {
    let logger = Logger()

    /*
     Implement this method if your extension supports showing credentials in the QuickType bar.
     When the user selects a credential from your app, this method will be called with the
     ASPasswordCredentialIdentity your app has previously saved to the ASCredentialIdentityStore.
     Provide the password by completing the extension request with the associated ASPasswordCredential.
     If using the credential would require showing custom UI for authenticating the user, cancel
     the request with error code ASExtensionError.userInteractionRequired.

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        let databaseIsUnlocked = true
        if (databaseIsUnlocked) {
            let passwordCredential = ASPasswordCredential(user: "j_appleseed", password: "apple1234")
            self.extensionContext.completeRequest(withSelectedCredential: passwordCredential, completionHandler: nil)
        } else {
            self.extensionContext.cancelRequest(withError: NSError(domain: ASExtensionErrorDomain, code:ASExtensionError.userInteractionRequired.rawValue))
        }
    }
    */

    /*
     Implement this method if provideCredentialWithoutUserInteraction(for:) can fail with
     ASExtensionError.userInteractionRequired. In this case, the system may present your extension's
     UI and call this method. Show appropriate UI for authenticating the user then provide the password
     by completing the extension request with the associated ASPasswordCredential.

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
    }
    */

    @IBAction func cancel(_ sender: AnyObject?) {
        self.extensionContext.cancelRequest(withError: NSError(domain: ASExtensionErrorDomain, code: ASExtensionError.userCanceled.rawValue))
    }

    @IBAction func passwordSelected(_ sender: AnyObject?) {
        let passwordCredential = ASPasswordCredential(user: "j_appleseed", password: "apple1234")
        self.extensionContext.completeRequest(withSelectedCredential: passwordCredential, completionHandler: nil)
    }
    
    override func prepareInterfaceForExtensionConfiguration() {
        logger.log("[autofill-extension] prepareInterfaceForExtensionConfiguration called")
    }

    override func prepareInterface(forPasskeyRegistration registrationRequest: ASCredentialRequest) {
        logger.log("[autofill-extension] prepare interface for registration request \(registrationRequest.description)")

//        self.extensionContext.cancelRequest(withError: ExampleError.nope)
    }

    override func prepareInterfaceToProvideCredential(for credentialRequest: ASCredentialRequest) {
        logger.log("[autofill-extension] prepare interface for credential request \(credentialRequest.description)")
    }

    /*
     Prepare your UI to list available credentials for the user to choose from. The items in
     'serviceIdentifiers' describe the service the user is logging in to, so your extension can
     prioritize the most relevant credentials in the list.
    */
    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        logger.log("[autofill-extension] prepareCredentialList for serviceIdentifiers: \(serviceIdentifiers.count)")

        for serviceIdentifier in serviceIdentifiers {
            logger.log("     service: \(serviceIdentifier.identifier)")
        }
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        logger.log("[autofill-extension] prepareInterfaceToProvideCredential for credentialIdentity: \(credentialIdentity.user)")
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier], requestParameters: ASPasskeyCredentialRequestParameters) {
        logger.log("[autofill-extension] prepareCredentialList(passkey) for serviceIdentifiers: \(serviceIdentifiers.count)")

        for serviceIdentifier in serviceIdentifiers {
            logger.log("     service: \(serviceIdentifier.identifier)")
        }

        logger.log("request parameters: \(requestParameters.relyingPartyIdentifier)")
    }

}
