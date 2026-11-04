#ifndef PLATFORM_PASSKEYS_H
#define PLATFORM_PASSKEYS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// [Shared with Rust] These types are mirrored in src/webauthn.rs.

/// Borrowed bytes. `data` may be NULL when `len` is 0.
struct WebAuthnBytes {
  const uint8_t *data;
  size_t len;
};

enum {
  WebAuthnUserVerificationRequired = 0,
  WebAuthnUserVerificationPreferred = 1,
  WebAuthnUserVerificationDiscouraged = 2,
};

/// Transports for reaching a credential on a security key, as a bitmask.
enum {
  WebAuthnTransportUsb = 1 << 0,
  WebAuthnTransportNfc = 1 << 1,
  WebAuthnTransportBle = 1 << 2,
  /// Every transport the device supports. Overrides the other bits.
  WebAuthnTransportAllSupported = 1 << 31,
};

struct WebAuthnCredentialDescriptor {
  struct WebAuthnBytes id;
  uint32_t transports;
};

struct WebAuthnAssertionRequest {
  /// The relying party ID, as a UTF-8 C string.
  const char *rp_id;
  struct WebAuthnBytes challenge;
  const struct WebAuthnCredentialDescriptor *allow_credentials;
  size_t allow_credentials_len;
  int32_t user_verification;
  /// PRF extension `eval` inputs. The system hashes them into salts.
  bool has_prf;
  struct WebAuthnBytes prf_first;
  bool has_prf_second;
  struct WebAuthnBytes prf_second;
  /// The U2F app ID from the `appid` extension as a UTF-8 C string, or NULL.
  const char *app_id;
};

enum {
  WebAuthnStatusSuccess = 0,
  /// This version of macOS does not support the request.
  WebAuthnStatusNotSupported = 1,
  /// The request could not be made, e.g. because the view is not in a window.
  WebAuthnStatusInvalidRequest = 2,
  /// The system failed the request, including when the user cancels it. `error_domain` and
  /// `error_code` identify the `NSError`.
  WebAuthnStatusAuthorizationError = 3,
};

enum {
  WebAuthnAttachmentUnknown = 0,
  WebAuthnAttachmentPlatform = 1,
  WebAuthnAttachmentCrossPlatform = 2,
};

enum {
  WebAuthnAppIdNotRequested = -1,
  WebAuthnAppIdNotUsed = 0,
  WebAuthnAppIdUsed = 1,
};

/// The result of an assertion. Everything it points to is only valid during the callback.
struct WebAuthnAssertionResult {
  int32_t status;
  /// UTF-8 C strings, set unless `status` is `WebAuthnStatusSuccess`.
  const char *error_message;
  const char *error_domain;
  int64_t error_code;

  struct WebAuthnBytes credential_id;
  struct WebAuthnBytes client_data_json;
  struct WebAuthnBytes authenticator_data;
  struct WebAuthnBytes signature;
  struct WebAuthnBytes user_handle;
  int32_t attachment;
  bool has_prf;
  struct WebAuthnBytes prf_first;
  bool has_prf_second;
  struct WebAuthnBytes prf_second;
  int32_t app_id_used;
};

typedef void (*WebAuthnAssertionCallback)(void *context, const struct WebAuthnAssertionResult *result);

/// [Callable from Rust]
/// Starts an assertion with the platform and security key passkey providers, presented modal to
/// the window containing `view` (an `NSView *`, from Electron's `getNativeWindowHandle()`).
///
/// The request is copied before this returns. `callback` is called exactly once with `context`,
/// on the main thread, or on the calling thread if the request fails before it starts. Returns
/// an operation that must be released with `webauthnReleaseOperation`.
void *webauthnGetAssertion(void *view,
                           const struct WebAuthnAssertionRequest *request,
                           void *context,
                           WebAuthnAssertionCallback callback);

/// [Callable from Rust]
/// Closes the operation's prompt, if it is still open. The callback reports the cancellation as
/// an `ASAuthorizationErrorCanceled` error. Callable from any thread.
void webauthnCancelOperation(void *operation);

/// [Callable from Rust]
/// Releases an operation returned by `webauthnGetAssertion`. This does not cancel it.
void webauthnReleaseOperation(void *operation);

#endif
