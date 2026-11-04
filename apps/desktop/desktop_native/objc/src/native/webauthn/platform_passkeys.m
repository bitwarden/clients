// Adapted by Bitwarden from Electron's
// shell/browser/webauthn/electron_platform_passkeys_authenticator_mac.mm
// (https://github.com/electron/electron/blob/050567d5793c2183eac49c6feb1e4c16ad020c54/shell/browser/webauthn/electron_platform_passkeys_authenticator_mac.mm,
// added in https://github.com/electron/electron/pull/51563).
//
// Copyright (c) 2026 Salesforce, Inc.
// Use of this source code is governed by the MIT license that can be
// found in Electron's LICENSE file
// (https://github.com/electron/electron/blob/050567d5793c2183eac49c6feb1e4c16ad020c54/LICENSE).
//
// Changes from the original:
// - Only assertions are supported, and they are driven from Rust through a C
//   interface instead of Chromium's FidoAuthenticator.
// - Security keys are offered alongside platform passkeys.
// - The PRF and appid extensions are supported.
// - The clientDataJSON returned by Apple is validated in Rust
//   (desktop_core/src/webauthn/client_data.rs).

// This file drives passkey operations via Apple's ASAuthorizationController
// API. Unlike browsers, the app doesn't (and can't) carry the
// com.apple.developer.web-browser.public-key-credential entitlement, but
// ASAuthorizationController works without it for any app that declares an
// Associated Domain with the "webcredentials:" service. Without that
// entitlement, the app can't provide its own clientDataJSON: Apple builds it
// from the challenge, with an `origin` of `https://<rpId>`.

#import "platform_passkeys.h"

#import <AppKit/AppKit.h>
#import <AuthenticationServices/AuthenticationServices.h>

static NSData *BytesToNSData(struct WebAuthnBytes bytes) {
  return [NSData dataWithBytes:bytes.data length:bytes.len];
}

static struct WebAuthnBytes NSDataToBytes(NSData *data) {
  struct WebAuthnBytes bytes = {data.bytes, data.length};
  return bytes;
}

static void ReportFailure(void *context,
                          WebAuthnAssertionCallback callback,
                          int32_t status,
                          NSString *message) {
  struct WebAuthnAssertionResult result = {0};
  result.status = status;
  result.error_message = message.UTF8String;
  result.error_domain = "";
  callback(context, &result);
}

API_AVAILABLE(macos(13.0))
static NSArray<ASAuthorizationSecurityKeyPublicKeyCredentialDescriptorTransport> *
SecurityKeyTransports(uint32_t transports) {
  if (transports & WebAuthnTransportAllSupported) {
    return ASAuthorizationAllSupportedPublicKeyCredentialDescriptorTransports();
  }
  NSMutableArray *result = [NSMutableArray array];
  if (transports & WebAuthnTransportUsb) {
    [result addObject:ASAuthorizationSecurityKeyPublicKeyCredentialDescriptorTransportUSB];
  }
  if (transports & WebAuthnTransportNfc) {
    [result addObject:ASAuthorizationSecurityKeyPublicKeyCredentialDescriptorTransportNFC];
  }
  if (transports & WebAuthnTransportBle) {
    [result addObject:ASAuthorizationSecurityKeyPublicKeyCredentialDescriptorTransportBluetooth];
  }
  return result;
}

API_AVAILABLE(macos(13.0))
static ASAuthorizationPublicKeyCredentialUserVerificationPreference
UserVerificationPreference(int32_t user_verification) {
  switch (user_verification) {
    case WebAuthnUserVerificationRequired:
      return ASAuthorizationPublicKeyCredentialUserVerificationPreferenceRequired;
    case WebAuthnUserVerificationDiscouraged:
      return ASAuthorizationPublicKeyCredentialUserVerificationPreferenceDiscouraged;
    default:
      return ASAuthorizationPublicKeyCredentialUserVerificationPreferencePreferred;
  }
}

/// Builds a platform request, for passkeys on this device or on a phone via hybrid, and a
/// security key request. The user chooses between them in the system's prompt.
API_AVAILABLE(macos(13.0))
static NSArray<ASAuthorizationRequest *> *BuildAssertionRequests(
    const struct WebAuthnAssertionRequest *request) {
  NSString *rpId = request->rp_id ? [NSString stringWithUTF8String:request->rp_id] : nil;
  if (rpId == nil) {
    return nil;
  }
  // Hand Apple the real challenge so it builds a clientDataJSON with it and
  // signs over its hash, letting the RP verify against the rawClientDataJSON
  // we return. We deliberately do NOT set the private `clientData` property:
  // the public API already produces a verifiable clientDataJSON for a
  // domain-associated app, and the KVC setter is Apple SPI that App Store
  // review rejects.
  NSData *challenge = BytesToNSData(request->challenge);
  ASAuthorizationPublicKeyCredentialUserVerificationPreference userVerification =
      UserVerificationPreference(request->user_verification);

  NSMutableArray *platformCredentials = [NSMutableArray array];
  NSMutableArray *securityKeyCredentials = [NSMutableArray array];
  for (size_t i = 0; i < request->allow_credentials_len; i++) {
    const struct WebAuthnCredentialDescriptor *credential = &request->allow_credentials[i];
    NSData *credentialId = BytesToNSData(credential->id);
    [platformCredentials
        addObject:[[ASAuthorizationPlatformPublicKeyCredentialDescriptor alloc]
                      initWithCredentialID:credentialId]];
    [securityKeyCredentials
        addObject:[[ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor alloc]
                      initWithCredentialID:credentialId
                                transports:SecurityKeyTransports(credential->transports)]];
  }

  ASAuthorizationPlatformPublicKeyCredentialProvider *platformProvider =
      [[ASAuthorizationPlatformPublicKeyCredentialProvider alloc]
          initWithRelyingPartyIdentifier:rpId];
  ASAuthorizationPlatformPublicKeyCredentialAssertionRequest *platformRequest =
      [platformProvider createCredentialAssertionRequestWithChallenge:challenge];
  platformRequest.allowedCredentials = platformCredentials;
  platformRequest.userVerificationPreference = userVerification;

  ASAuthorizationSecurityKeyPublicKeyCredentialProvider *securityKeyProvider =
      [[ASAuthorizationSecurityKeyPublicKeyCredentialProvider alloc]
          initWithRelyingPartyIdentifier:rpId];
  ASAuthorizationSecurityKeyPublicKeyCredentialAssertionRequest *securityKeyRequest =
      [securityKeyProvider createCredentialAssertionRequestWithChallenge:challenge];
  securityKeyRequest.allowedCredentials = securityKeyCredentials;
  securityKeyRequest.userVerificationPreference = userVerification;

  // Credentials registered with the U2F API can only be on security keys.
  if (request->app_id != NULL) {
    if (@available(macOS 14.5, *)) {
      securityKeyRequest.appID = [NSString stringWithUTF8String:request->app_id];
    }
  }

  if (request->has_prf) {
    if (@available(macOS 15.0, *)) {
      // These are the WebAuthn-level `eval` inputs; the system hashes them
      // into salts, as WebKit relies on.
      ASAuthorizationPublicKeyCredentialPRFAssertionInputValues *values =
          [[ASAuthorizationPublicKeyCredentialPRFAssertionInputValues alloc]
              initWithSaltInput1:BytesToNSData(request->prf_first)
                      saltInput2:request->has_prf_second ? BytesToNSData(request->prf_second)
                                                         : nil];
      ASAuthorizationPublicKeyCredentialPRFAssertionInput *prf =
          [[ASAuthorizationPublicKeyCredentialPRFAssertionInput alloc]
                   initWithInputValues:values
              perCredentialInputValues:nil];
      platformRequest.prf = prf;
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 260400
      if (@available(macOS 26.4, *)) {
        securityKeyRequest.prf = prf;
      }
#endif
    }
  }

  return @[ platformRequest, securityKeyRequest ];
}

// MARK: - ObjC Delegate

API_AVAILABLE(macos(13.0))
@interface BitwardenPlatformPasskeyDelegate
    : NSObject <ASAuthorizationControllerDelegate,
                ASAuthorizationControllerPresentationContextProviding>

@property(nonatomic, weak) NSWindow *presentationAnchor;
@property(nonatomic, copy) void (^assertionHandler)
    (NSError *, id<ASAuthorizationPublicKeyCredentialAssertion>);

@end

API_AVAILABLE(macos(13.0))
@implementation BitwardenPlatformPasskeyDelegate

- (ASPresentationAnchor)presentationAnchorForAuthorizationController:
    (ASAuthorizationController *)controller {
  return self.presentationAnchor;
}

- (void)authorizationController:(ASAuthorizationController *)controller
    didCompleteWithAuthorization:(ASAuthorization *)authorization {
  id credential = authorization.credential;
  // Both platform and security key assertions conform to this protocol.
  if (![credential conformsToProtocol:@protocol(ASAuthorizationPublicKeyCredentialAssertion)]) {
    credential = nil;
  }
  if (self.assertionHandler) {
    self.assertionHandler(nil, credential);
    self.assertionHandler = nil;
  }
}

- (void)authorizationController:(ASAuthorizationController *)controller
           didCompleteWithError:(NSError *)error {
  if (self.assertionHandler) {
    self.assertionHandler(error, nil);
    self.assertionHandler = nil;
  }
}

@end

// MARK: - Operation

/// The state of one assertion. Everything after initialization happens on the main queue.
@interface BitwardenPlatformPasskeyOperation : NSObject

@property(nonatomic) NSView *view;
@property(nonatomic, copy) NSArray *requests;
@property(nonatomic) BOOL appIdRequested;
@property(nonatomic) void *context;
@property(nonatomic) WebAuthnAssertionCallback callback;

// ASAuthorizationController and BitwardenPlatformPasskeyDelegate, which are
// typed as `id` because they need macOS 13.
@property(nonatomic) id controller;
@property(nonatomic) id delegate;
@property(nonatomic) BOOL cancelled;
@property(nonatomic) BOOL finished;

@end

@implementation BitwardenPlatformPasskeyOperation

- (void)start API_AVAILABLE(macos(13.0)) {
  if (self.cancelled) {
    [self completeWithError:[NSError errorWithDomain:ASAuthorizationErrorDomain
                                                code:ASAuthorizationErrorCanceled
                                            userInfo:nil]
                  assertion:nil];
    return;
  }

  NSWindow *window = self.view.window;
  if (window == nil) {
    [self failWithStatus:WebAuthnStatusInvalidRequest message:@"The view is not in a window"];
    return;
  }

  BitwardenPlatformPasskeyDelegate *delegate = [[BitwardenPlatformPasskeyDelegate alloc] init];
  delegate.presentationAnchor = window;
  // The operation keeps itself alive until the system completes the request.
  delegate.assertionHandler =
      ^(NSError *error, id<ASAuthorizationPublicKeyCredentialAssertion> assertion) {
        [self completeWithError:error assertion:assertion];
      };

  ASAuthorizationController *controller =
      [[ASAuthorizationController alloc] initWithAuthorizationRequests:self.requests];
  controller.delegate = delegate;
  controller.presentationContextProvider = delegate;
  self.delegate = delegate;
  self.controller = controller;
  [controller performRequests];
}

- (void)cancel API_AVAILABLE(macos(13.0)) {
  self.cancelled = YES;
  [(ASAuthorizationController *)self.controller cancel];
}

- (void)failWithStatus:(int32_t)status message:(NSString *)message {
  if (self.finished) {
    return;
  }
  self.finished = YES;
  ReportFailure(self.context, self.callback, status, message);
  [self cleanUp];
}

- (void)completeWithError:(NSError *)error
                assertion:(id<ASAuthorizationPublicKeyCredentialAssertion>)assertion
    API_AVAILABLE(macos(13.0)) {
  if (self.finished) {
    return;
  }
  self.finished = YES;

  struct WebAuthnAssertionResult result = {0};
  if (error != nil || assertion == nil) {
    NSString *message = error ? error.localizedDescription : @"No assertion was returned";
    NSString *domain = error ? error.domain : ASAuthorizationErrorDomain;
    result.status = WebAuthnStatusAuthorizationError;
    result.error_message = message.UTF8String;
    result.error_domain = domain.UTF8String;
    result.error_code = error ? error.code : ASAuthorizationErrorInvalidResponse;
    self.callback(self.context, &result);
    [self cleanUp];
    return;
  }

  // Hold the data in locals so that it stays alive during the callback.
  NSData *credentialId = assertion.credentialID;
  NSData *clientDataJson = assertion.rawClientDataJSON;
  NSData *authenticatorData = assertion.rawAuthenticatorData;
  NSData *signature = assertion.signature;
  NSData *userHandle = assertion.userID;
  NSData *prfFirst = nil;
  NSData *prfSecond = nil;

  result.status = WebAuthnStatusSuccess;
  result.credential_id = NSDataToBytes(credentialId);
  result.client_data_json = NSDataToBytes(clientDataJson);
  result.authenticator_data = NSDataToBytes(authenticatorData);
  result.signature = NSDataToBytes(signature);
  result.user_handle = NSDataToBytes(userHandle);
  result.app_id_used = self.appIdRequested ? WebAuthnAppIdNotUsed : WebAuthnAppIdNotRequested;

  if ([(id)assertion isKindOfClass:[ASAuthorizationPlatformPublicKeyCredentialAssertion class]]) {
    ASAuthorizationPlatformPublicKeyCredentialAssertion *platform =
        (ASAuthorizationPlatformPublicKeyCredentialAssertion *)assertion;
    if (@available(macOS 13.5, *)) {
      // Cross-platform means a phone, via hybrid.
      result.attachment = platform.attachment == ASAuthorizationPublicKeyCredentialAttachmentPlatform
                              ? WebAuthnAttachmentPlatform
                              : WebAuthnAttachmentCrossPlatform;
    }
    if (@available(macOS 15.0, *)) {
      prfFirst = platform.prf.first;
      prfSecond = platform.prf.second;
    }
  } else if ([(id)assertion
                 isKindOfClass:[ASAuthorizationSecurityKeyPublicKeyCredentialAssertion class]]) {
    ASAuthorizationSecurityKeyPublicKeyCredentialAssertion *securityKey =
        (ASAuthorizationSecurityKeyPublicKeyCredentialAssertion *)assertion;
    result.attachment = WebAuthnAttachmentCrossPlatform;
    if (self.appIdRequested) {
      if (@available(macOS 14.5, *)) {
        result.app_id_used = securityKey.appID ? WebAuthnAppIdUsed : WebAuthnAppIdNotUsed;
      }
    }
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 260400
    if (@available(macOS 26.4, *)) {
      prfFirst = securityKey.prf.first;
      prfSecond = securityKey.prf.second;
    }
#endif
  }

  if (prfFirst != nil) {
    result.has_prf = true;
    result.prf_first = NSDataToBytes(prfFirst);
    result.has_prf_second = prfSecond != nil;
    result.prf_second = NSDataToBytes(prfSecond);
  }

  self.callback(self.context, &result);
  [self cleanUp];
}

/// Releases the system objects on the main queue, and breaks the delegate's reference cycle.
- (void)cleanUp {
  [self.delegate setAssertionHandler:nil];
  self.controller = nil;
  self.delegate = nil;
  self.view = nil;
  self.requests = nil;
}

@end

// MARK: - C interface

void *webauthnGetAssertion(void *view,
                           const struct WebAuthnAssertionRequest *request,
                           void *context,
                           WebAuthnAssertionCallback callback) {
  @autoreleasepool {
    BitwardenPlatformPasskeyOperation *operation = [[BitwardenPlatformPasskeyOperation alloc] init];
    operation.context = context;
    operation.callback = callback;
    // Retained here, while the caller guarantees that the view is alive.
    operation.view = (__bridge NSView *)view;

    if (@available(macOS 13.0, *)) {
      NSArray *requests = BuildAssertionRequests(request);
      if (requests == nil) {
        [operation failWithStatus:WebAuthnStatusInvalidRequest
                          message:@"The relying party ID is not valid UTF-8"];
      } else {
        operation.requests = requests;
        operation.appIdRequested = request->app_id != NULL;
        dispatch_async(dispatch_get_main_queue(), ^{
          [operation start];
        });
      }
    } else {
      [operation failWithStatus:WebAuthnStatusNotSupported
                        message:@"Passkeys require macOS 13 or later"];
    }

    return (__bridge_retained void *)operation;
  }
}

void webauthnCancelOperation(void *operation) {
  BitwardenPlatformPasskeyOperation *op = (__bridge BitwardenPlatformPasskeyOperation *)operation;
  // The cancellation is queued after the start, so it is not missed.
  dispatch_async(dispatch_get_main_queue(), ^{
    if (@available(macOS 13.0, *)) {
      [op cancel];
    }
  });
}

void webauthnReleaseOperation(void *operation) {
  BitwardenPlatformPasskeyOperation *op = (__bridge_transfer BitwardenPlatformPasskeyOperation *)operation;
  // Release the last reference, which may own system objects, on the main queue.
  dispatch_async(dispatch_get_main_queue(), ^{
    (void)op;
  });
}
