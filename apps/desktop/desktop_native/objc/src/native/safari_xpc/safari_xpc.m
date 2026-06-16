#import "safari_xpc.h"

/// [Callable from Rust]
/// Create and start an app-group XPC listener. The Safari web extension (a member of the same app
/// group) connects to this Mach service to send and poll for messages.
///
/// The service name must be prefixed with an application-group identifier that both processes are
/// entitled to (`LTZ2PFU5D6.com.bitwarden.desktop`), which is how a sandboxed app vends a Mach
/// service without a launchd registration.
void *bw_safari_xpc_start(const char *service_name, void *ctx) {
  dispatch_queue_t queue = dispatch_queue_create("com.bitwarden.safari.xpc", DISPATCH_QUEUE_SERIAL);
  xpc_connection_t listener =
      xpc_connection_create_mach_service(service_name, queue, XPC_CONNECTION_MACH_SERVICE_LISTENER);
  if (listener == NULL) {
    return NULL;
  }

  xpc_connection_set_event_handler(listener, ^(xpc_object_t peer) {
    // The listener handler also receives XPC_TYPE_ERROR objects; only connections are actionable.
    if (xpc_get_type(peer) != XPC_TYPE_CONNECTION) {
      return;
    }

    xpc_connection_set_event_handler(peer, ^(xpc_object_t message) {
      // Per-connection errors (e.g. the peer disconnecting) arrive here as XPC_TYPE_ERROR.
      if (xpc_get_type(message) != XPC_TYPE_DICTIONARY) {
        return;
      }

      size_t req_len = 0;
      const void *req = xpc_dictionary_get_data(message, "req", &req_len);

      uint8_t *out = NULL;
      size_t out_len = 0;
      bw_safari_handle_request(ctx, (const uint8_t *)req, req_len, &out, &out_len);

      xpc_object_t reply = xpc_dictionary_create_reply(message);
      if (reply != NULL) {
        xpc_dictionary_set_data(reply, "res", out, out_len);
        xpc_connection_t remote = xpc_dictionary_get_remote_connection(message);
        if (remote != NULL) {
          xpc_connection_send_message(remote, reply);
        }
      }

      if (out != NULL) {
        bw_safari_xpc_free(out, out_len);
      }
    });

    xpc_connection_resume(peer);
  });

  xpc_connection_resume(listener);

  // Hand a strong reference to Rust; released in bw_safari_xpc_stop.
  return (void *)CFBridgingRetain(listener);
}

/// [Callable from Rust]
/// Cancel and release a listener handle.
void bw_safari_xpc_stop(void *handle) {
  if (handle == NULL) {
    return;
  }
  xpc_connection_t listener = (xpc_connection_t)CFBridgingRelease(handle);
  xpc_connection_cancel(listener);
}
