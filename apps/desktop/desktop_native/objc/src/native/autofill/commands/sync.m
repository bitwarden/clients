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
    @try {
      NSString *type = credential[@"type"];
      
      if ([type isEqualToString:@"password"]) {
        NSString *cipherId = credential[@"cipherId"];
        NSString *uri = credential[@"uri"];
        NSString *username = credential[@"username"];
        
        // Skip credentials with null username
        if ([username isKindOfClass:[NSNull class]] || username.length == 0) {
            NSLog(@"Skipping credential, username is empty: %@", credential);
          continue;
        }

        ASCredentialServiceIdentifier *serviceId = [[ASCredentialServiceIdentifier alloc]
          initWithIdentifier:uri type:ASCredentialServiceIdentifierTypeURL];
        ASPasswordCredentialIdentity *passwordIdentity = [[ASPasswordCredentialIdentity alloc]
          initWithServiceIdentifier:serviceId user:username recordIdentifier:cipherId];

        [mappedCredentials addObject:passwordIdentity];
      } 
      else if (@available(macos 14, *)) {
        if ([type isEqualToString:@"fido2"]) {
          NSString *cipherId = credential[@"cipherId"];
          NSString *rpId = credential[@"rpId"];
          NSString *userName = credential[@"userName"];
          
          // Skip credentials with null userName
          if ([userName isKindOfClass:[NSNull class]] || userName.length == 0) {
            NSLog(@"Skipping credential, username is empty: %@", credential);
            continue;
          }
          
          NSData *credentialId = decodeBase64URL(credential[@"credentialId"]);
          NSData *userHandle = decodeBase64URL(credential[@"userHandle"]);
          
          Class passkeyCredentialIdentityClass = NSClassFromString(@"ASPasskeyCredentialIdentity");
          id passkeyIdentity = [[passkeyCredentialIdentityClass alloc]
            initWithRelyingPartyIdentifier:rpId
            userName:userName
            credentialID:credentialId
            userHandle:userHandle
            recordIdentifier:cipherId];

          [mappedCredentials addObject:passkeyIdentity];
        }
      }
    } @catch (NSException *exception) {
      // Silently skip any credential that causes an exception
      NSLog(@"ERROR: Exception processing credential: %@ - %@", exception.name, exception.reason);
      continue;
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