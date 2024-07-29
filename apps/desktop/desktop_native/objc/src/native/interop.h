#ifndef INTEROP_H
#define INTEROP_H

#import <Foundation/Foundation.h>

/// [Shared with Rust]
/// Simple struct to hold a C-string and its length
/// This is used to return strings created in Objective-C to Rust
/// so that Rust can free the memory when it's done with the string
struct ObjCString
{
  char *value;
  size_t size;
};

/// [Defined in Rust]
/// External function callable from Objective-C to return a string to Rust
extern bool commandReturn(void *context, struct ObjCString output);

/// [Callable from Rust]
/// Frees the memory allocated for an ObjCString
void freeObjCString(struct ObjCString *value);

// --- Helper functions to convert between Objective-C and Rust types ---

NSString *_success(NSDictionary *value);
NSString *_error(NSString *error);
NSString *_error_er(NSError *error);
NSString *_error_ex(NSException *error);
void _return(void *context, NSString *output);

struct ObjCString nsStringToObjCString(NSString *string);
NSString *cStringToNSString(char *string);

#endif
