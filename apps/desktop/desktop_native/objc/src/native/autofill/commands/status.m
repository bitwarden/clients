#import <Foundation/Foundation.h>
#import <AuthenticationServices/ASCredentialIdentityStore.h>
#import <AuthenticationServices/ASCredentialIdentityStoreState.h>
#import "../../interop.h"
#import "status.h"

void storeState(void (^callback)(ASCredentialIdentityStoreState*)) {
  if (@available(macos 11, *)) {
    ASCredentialIdentityStore *store = [ASCredentialIdentityStore sharedStore];
    [store getCredentialIdentityStoreStateWithCompletion:^(ASCredentialIdentityStoreState * _Nonnull state) {
      callback(state);
    }];
  } else {
    callback(nil);
  }
}

BOOL fido2Supported() {
  if (@available(macos 14, *)) {
    return YES;
  } else {
    return NO;
  }
}

BOOL passwordSupported() {
  if (@available(macos 11, *)) {
    return YES;
  } else {
    return NO;
  }
}

void status(void* context, __attribute__((unused)) NSDictionary *params) {
  storeState(^(ASCredentialIdentityStoreState *state) {
    BOOL enabled = NO;
    BOOL supportsIncremental = NO;

    if (state != nil) {
      enabled = state.isEnabled;
      supportsIncremental = state.supportsIncrementalUpdates;
    }

    _return(context,
      _success(@{
        @"support": @{
          @"fido2": @(fido2Supported()),
          @"password": @(passwordSupported()),
          @"incrementalUpdates": @(supportsIncremental),
        },
        @"state": @{
          @"enabled": @(enabled),
        }
      })
    );
  });
}
