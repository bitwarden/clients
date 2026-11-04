#import "web_authentication_session.h"

#import <AppKit/AppKit.h>
#import <AuthenticationServices/AuthenticationServices.h>
#import <Security/Security.h>

/// The state of one session. Everything after initialization happens on the main queue.
@interface BitwardenWebAuthenticationOperation : NSObject <ASWebAuthenticationPresentationContextProviding>

@property(nonatomic) NSView *view;
@property(nonatomic, weak) NSWindow *window;
@property(nonatomic, copy) NSURL *url;
@property(nonatomic, copy) NSString *callbackScheme;
@property(nonatomic) BOOL ephemeral;
@property(nonatomic) void *context;
@property(nonatomic) WebAuthenticationSessionCallback callback;

@property(nonatomic) ASWebAuthenticationSession *session;
@property(nonatomic) BOOL cancelled;
@property(nonatomic) BOOL finished;

@end

@implementation BitwardenWebAuthenticationOperation

- (void)start {
  if (self.cancelled) {
    [self completeWithURL:nil error:[self canceledError]];
    return;
  }

  NSWindow *window = self.view.window;
  if (window == nil) {
    [self failWithStatus:WebAuthenticationSessionStatusInvalidRequest
                 message:@"The view is not in a window"];
    return;
  }
  self.window = window;

  // The operation keeps itself alive until the session completes.
  ASWebAuthenticationSessionCompletionHandler completionHandler = ^(NSURL *callbackURL,
                                                                    NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self completeWithURL:callbackURL error:error];
    });
  };
  ASWebAuthenticationSession *session;
  if (@available(macOS 14.4, *)) {
    session = [[ASWebAuthenticationSession alloc]
              initWithURL:self.url
                 callback:[ASWebAuthenticationSessionCallback
                              callbackWithCustomScheme:self.callbackScheme]
        completionHandler:completionHandler];
  } else {
    session = [[ASWebAuthenticationSession alloc] initWithURL:self.url
                                            callbackURLScheme:self.callbackScheme
                                            completionHandler:completionHandler];
  }
  session.presentationContextProvider = self;
  session.prefersEphemeralWebBrowserSession = self.ephemeral;
  self.session = session;
  if (![session start]) {
    [self failWithStatus:WebAuthenticationSessionStatusInvalidRequest
                 message:@"The web authentication session could not be started"];
  }
}

- (void)cancel {
  self.cancelled = YES;
  [self.session cancel];
  // Cancelling is not documented to call the completion handler, so complete here. If it is
  // called, it is ignored.
  if (self.session != nil) {
    [self completeWithURL:nil error:[self canceledError]];
  }
}

- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:
    (ASWebAuthenticationSession *)session {
  return self.window;
}

- (NSError *)canceledError {
  return [NSError errorWithDomain:ASWebAuthenticationSessionErrorDomain
                             code:ASWebAuthenticationSessionErrorCodeCanceledLogin
                         userInfo:nil];
}

- (void)failWithStatus:(int32_t)status message:(NSString *)message {
  if (self.finished) {
    return;
  }
  self.finished = YES;
  struct WebAuthenticationSessionResult result = {0};
  result.status = status;
  result.error_message = message.UTF8String;
  result.error_domain = "";
  self.callback(self.context, &result);
  [self cleanUp];
}

- (void)completeWithURL:(NSURL *)callbackURL error:(NSError *)error {
  if (self.finished) {
    return;
  }
  self.finished = YES;

  struct WebAuthenticationSessionResult result = {0};
  // Hold the strings in locals so that they stay alive during the callback.
  NSString *url = callbackURL.absoluteString;
  NSString *message = nil;
  NSString *domain = nil;
  if (error != nil || url == nil) {
    message = error ? error.localizedDescription : @"No callback URL was returned";
    domain = error ? error.domain : ASWebAuthenticationSessionErrorDomain;
    result.status = WebAuthenticationSessionStatusError;
    result.error_message = message.UTF8String;
    result.error_domain = domain.UTF8String;
    result.error_code = error ? error.code : ASWebAuthenticationSessionErrorCodeCanceledLogin;
  } else {
    result.status = WebAuthenticationSessionStatusSuccess;
    result.callback_url = url.UTF8String;
  }
  self.callback(self.context, &result);
  [self cleanUp];
}

/// Releases the system objects on the main queue, and breaks the session's reference cycle.
- (void)cleanUp {
  self.session = nil;
  self.view = nil;
}

@end

// MARK: - C interface

void *webAuthenticationSessionStart(void *view,
                                    const char *url,
                                    const char *callback_scheme,
                                    bool ephemeral,
                                    void *context,
                                    WebAuthenticationSessionCallback callback) {
  @autoreleasepool {
    BitwardenWebAuthenticationOperation *operation =
        [[BitwardenWebAuthenticationOperation alloc] init];
    operation.context = context;
    operation.callback = callback;
    // Retained here, while the caller guarantees that the view is alive.
    operation.view = (__bridge NSView *)view;
    operation.ephemeral = ephemeral;

    NSString *urlString = url ? [NSString stringWithUTF8String:url] : nil;
    NSURL *nsUrl = urlString ? [NSURL URLWithString:urlString] : nil;
    NSString *scheme = callback_scheme ? [NSString stringWithUTF8String:callback_scheme] : nil;
    if (nsUrl == nil || scheme == nil) {
      [operation failWithStatus:WebAuthenticationSessionStatusInvalidRequest
                        message:@"The URL or callback scheme is not valid"];
    } else {
      operation.url = nsUrl;
      operation.callbackScheme = scheme;
      dispatch_async(dispatch_get_main_queue(), ^{
        [operation start];
      });
    }

    return (__bridge_retained void *)operation;
  }
}

void webAuthenticationSessionCancel(void *operation) {
  BitwardenWebAuthenticationOperation *op =
      (__bridge BitwardenWebAuthenticationOperation *)operation;
  // The cancellation is queued after the start, so it is not missed.
  dispatch_async(dispatch_get_main_queue(), ^{
    [op cancel];
  });
}

void webAuthenticationSessionRelease(void *operation) {
  BitwardenWebAuthenticationOperation *op =
      (__bridge_transfer BitwardenWebAuthenticationOperation *)operation;
  // Release the last reference, which may own system objects, on the main queue.
  dispatch_async(dispatch_get_main_queue(), ^{
    (void)op;
  });
}

struct ObjCString webCredentialsAssociatedDomains(void) {
  @autoreleasepool {
    NSMutableArray<NSString *> *domains = [NSMutableArray array];
    SecTaskRef task = SecTaskCreateFromSelf(kCFAllocatorDefault);
    if (task != NULL) {
      id entries = CFBridgingRelease(SecTaskCopyValueForEntitlement(
          task, CFSTR("com.apple.developer.associated-domains"), NULL));
      CFRelease(task);
      if ([entries isKindOfClass:[NSArray class]]) {
        for (id entry in entries) {
          if ([entry isKindOfClass:[NSString class]] && [entry hasPrefix:@"webcredentials:"]) {
            [domains addObject:[entry substringFromIndex:@"webcredentials:".length]];
          }
        }
      }
    }
    return nsStringToObjCString([domains componentsJoinedByString:@"\n"]);
  }
}
