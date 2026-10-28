#import <Foundation/Foundation.h>
#import <AuthenticationServices/ASSettingsHelper.h>
#import "../../interop.h"
#import "settings.h"

// Declared in the macOS 15 SDK and later, so it is redeclared here to build against older SDKs.
// Calls are guarded by `@available(macos 15, *)`.
@interface ASSettingsHelper (CredentialProviderExtensionRequest)
+ (void)requestToTurnOnCredentialProviderExtensionWithCompletionHandler:
    (void (^)(BOOL appWasEnabledForAutoFill))completionHandler API_AVAILABLE(macos(15.0));
@end

void requestEnable(void* context, __attribute__((unused)) NSDictionary *params) {
  if (@available(macos 15, *)) {
    // The prompt is presented on behalf of the app, so request it from the main thread.
    dispatch_async(dispatch_get_main_queue(), ^{
      [ASSettingsHelper requestToTurnOnCredentialProviderExtensionWithCompletionHandler:^(BOOL enabled) {
        _return(context, _success(@{@"supported": @YES, @"enabled": @(enabled)}));
      }];
    });
  } else {
    _return(context, _success(@{@"supported": @NO, @"enabled": @NO}));
  }
}

void openSettings(void* context, __attribute__((unused)) NSDictionary *params) {
  if (@available(macos 14, *)) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [ASSettingsHelper openCredentialProviderAppSettingsWithCompletionHandler:^(NSError *error) {
        if (error != nil) {
          return _return(context, _error_er(error));
        }
        _return(context, _success(@{}));
      }];
    });
  } else {
    _return(context, _error(@"Opening the credential provider settings requires macOS 14 or later"));
  }
}
