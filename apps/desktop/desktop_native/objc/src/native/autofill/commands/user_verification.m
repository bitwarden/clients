#import <Foundation/Foundation.h>
#import <LocalAuthentication/LocalAuthentication.h>
#import "../../interop.h"
#import "user_verification.h"

void userVerification(void* context, NSDictionary *params) {
  NSString *displayHint = params[@"displayHint"];
  if (displayHint == nil) {
    return _return(context, _error(@"No display hint was provided for the user verification prompt"));
  }

  LAContext *uvContext = [[LAContext alloc] init];
  // The device password is accepted alongside biometrics so that machines with
  // no enrolled biometric can still complete a passkey ceremony.
  LAPolicy policy = LAPolicyDeviceOwnerAuthentication;

  NSError *error = nil;
  if (![uvContext canEvaluatePolicy:policy error:&error]) {
    return _return(context, _error_er(error));
  }

  [uvContext evaluatePolicy:policy
            localizedReason:displayHint
                      reply:^(BOOL success, NSError *_Nullable replyError) {
    if (success) {
      return _return(context, _success(@{@"outcome": @"verified"}));
    }

    // Dismissing the prompt is an answer, not a failure, so it is reported as
    // an outcome the caller can act on rather than an error indistinguishable
    // from a broken request.
    switch (replyError.code) {
      case LAErrorUserCancel:
      case LAErrorSystemCancel:
      case LAErrorAppCancel:
        return _return(context, _success(@{@"outcome": @"cancelled"}));
      default:
        return _return(context, _error_er(replyError));
    }
  }];
}