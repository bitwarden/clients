#ifndef WEB_AUTHENTICATION_SESSION_H
#define WEB_AUTHENTICATION_SESSION_H

#include <stdbool.h>
#include <stdint.h>

#import "../interop.h"

// [Shared with Rust] These types are mirrored in src/web_authentication_session.rs.

enum {
  WebAuthenticationSessionStatusSuccess = 0,
  /// The session could not be started, e.g. because the view is not in a window.
  WebAuthenticationSessionStatusInvalidRequest = 1,
  /// The session failed, including when the user cancels it. `error_domain` and `error_code`
  /// identify the `NSError`.
  WebAuthenticationSessionStatusError = 2,
};

/// The result of a session. Everything it points to is only valid during the callback.
struct WebAuthenticationSessionResult {
  int32_t status;
  /// The URL the page redirected to, as a UTF-8 C string, if `status` is
  /// `WebAuthenticationSessionStatusSuccess`.
  const char *callback_url;
  /// UTF-8 C strings, set unless `status` is `WebAuthenticationSessionStatusSuccess`.
  const char *error_message;
  const char *error_domain;
  int64_t error_code;
};

typedef void (*WebAuthenticationSessionCallback)(void *context,
                                                 const struct WebAuthenticationSessionResult *result);

/// [Callable from Rust]
/// Opens `url` in an `ASWebAuthenticationSession`, presented from the window containing `view`
/// (an `NSView *`, from Electron's `getNativeWindowHandle()`). The session completes when the page
/// navigates to a URL with the scheme `callback_scheme`. That URL is delivered to `callback` only,
/// not to the app's URL scheme handler.
///
/// The arguments are copied before this returns. `callback` is called exactly once with `context`,
/// on the main thread, or on the calling thread if the session fails before it starts. Returns an
/// operation that must be released with `webAuthenticationSessionRelease`.
void *webAuthenticationSessionStart(void *view,
                                    const char *url,
                                    const char *callback_scheme,
                                    bool ephemeral,
                                    void *context,
                                    WebAuthenticationSessionCallback callback);

/// [Callable from Rust]
/// Closes the session, if it is still open. The callback reports the cancellation as an
/// `ASWebAuthenticationSessionErrorCodeCanceledLogin` error. Callable from any thread.
void webAuthenticationSessionCancel(void *operation);

/// [Callable from Rust]
/// Releases an operation returned by `webAuthenticationSessionStart`. This does not cancel it.
void webAuthenticationSessionRelease(void *operation);

/// [Callable from Rust]
/// Returns the `webcredentials:` entries of this process's associated domains entitlement,
/// separated by newlines, without the service prefix. Empty if there are none, e.g. in an
/// unsigned build.
struct ObjCString webCredentialsAssociatedDomains(void);

#endif
