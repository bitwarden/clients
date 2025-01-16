#import <Foundation/Foundation.h>
#import <AuthenticationServices/ASCredentialIdentityStore.h>
#import <AuthenticationServices/ASCredentialIdentityStoreState.h>
#import <AuthenticationServices/ASCredentialServiceIdentifier.h>
#import <AuthenticationServices/ASPasswordCredentialIdentity.h>
#import <AuthenticationServices/ASPasskeyCredentialIdentity.h>
#import "../../utils.h"
#import "../../interop.h"
#import "sync.h"

// 'run' is added to the name because it clashes with internal macOS function
void runSync(void* context, NSDictionary *params) {
  NSArray *credentials = params[@"credentials"];

  // Map credentials to ASPasswordCredential objects
  NSMutableArray *mappedCredentials = [NSMutableArray arrayWithCapacity:credentials.count];
  for (NSDictionary *credential in credentials) {
    NSString *type = credential[@"type"];

    if ([type isEqualToString:@"password"]) {
      NSString *cipherId = credential[@"cipherId"];
      NSString *uri = credential[@"uri"];
      NSString *username = credential[@"username"];

      ASCredentialServiceIdentifier *serviceId = [[ASCredentialServiceIdentifier alloc]
        initWithIdentifier:uri type:ASCredentialServiceIdentifierTypeURL];
      ASPasswordCredentialIdentity *credential = [[ASPasswordCredentialIdentity alloc]
        initWithServiceIdentifier:serviceId user:username recordIdentifier:cipherId];

      [mappedCredentials addObject:credential];
    }

    if (@available(macos 14, *)) {
      if ([type isEqualToString:@"fido2"]) {
        NSString *cipherId = credential[@"cipherId"];
        NSString *rpId = credential[@"rpId"];
        NSString *userName = credential[@"userName"];
        NSData *credentialId = decodeBase64URL(credential[@"credentialId"]);
        NSData *userHandle = decodeBase64URL(credential[@"userHandle"]);

        Class passkeyCredentialIdentityClass = NSClassFromString(@"ASPasskeyCredentialIdentity");
        id credential = [[passkeyCredentialIdentityClass alloc]
          initWithRelyingPartyIdentifier:rpId
          userName:userName
          credentialID:credentialId
          userHandle:userHandle
          recordIdentifier:cipherId];

        [mappedCredentials addObject:credential];
      }
    }
  }

  [ASCredentialIdentityStore.sharedStore replaceCredentialIdentityEntries:mappedCredentials
    completion:^(__attribute__((unused)) BOOL success, NSError * _Nullable error) {
      if (error) {
        return _return(context, _error_er(error));
      }

      _return(context, _success(@{@"added": @([mappedCredentials count])}));
    }];
}
