#ifndef SAFARI_XPC_H
#define SAFARI_XPC_H

#import <Foundation/Foundation.h>
#import <xpc/xpc.h> // xpc_* lives in libSystem; no extra framework link needed

// [Defined in Rust]
// Invoked synchronously by the shim for each incoming request. Rust allocates the response and
// returns it via the out-params; the shim copies it into the XPC reply, then calls
// bw_safari_xpc_free to release the Rust allocation. `req` may be NULL / `req_len` 0.
extern void bw_safari_handle_request(void *ctx, const uint8_t *req, size_t req_len,
                                     uint8_t **out, size_t *out_len);

// [Defined in Rust]
// Frees a response buffer previously produced by bw_safari_handle_request.
extern void bw_safari_xpc_free(uint8_t *ptr, size_t len);

// [Callable from Rust]
// Create and start an app-group XPC listener on `service_name`. Returns a retained listener handle
// (or NULL on failure) that must be released with bw_safari_xpc_stop. `ctx` is passed back to
// bw_safari_handle_request for every request and must outlive the listener.
void *bw_safari_xpc_start(const char *service_name, void *ctx);

// [Callable from Rust]
// Cancel and release a listener handle returned by bw_safari_xpc_start.
void bw_safari_xpc_stop(void *handle);

#endif
