#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <LocalAuthentication/LocalAuthentication.h>
#import "../../utils.h"
#import "../../interop.h"
#import "user_verification.h"

void userVerification(void* context, NSDictionary *params) {
  // TODO: Make this more functional by using LAAuthenticationView from @import LocalAuthenticationEmbeddedUI;
  LAContext *uvContext = [[LAContext alloc] init];
  uvContext.localizedCancelTitle = @"Enter Password";
  LAPolicy policy = LAPolicyDeviceOwnerAuthentication;
  NSError *error;
  if (![uvContext canEvaluatePolicy: policy error:&error]) {
    NSLog(@"Could not evaluate UV policy: %@", [error localizedDescription]);
    return _return(context, _error_er(error));
  } 

  NSString *displayHint = params[@"displayHint"];
  [uvContext evaluatePolicy:policy localizedReason:displayHint reply:^(BOOL success, NSError * _Nullable error) {
    if (!success) {
      return _return(context, _error_er(error));
    }
    _return(context, _success(@{}));
  }];
}
