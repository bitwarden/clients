#import "interop.h"
#import "utils.h"

/// [Callable from Rust]
/// Frees the memory allocated for an ObjCString
void freeObjCString(struct ObjCString *value) {
  free(value->value);
}

// --- Helper functions to convert between Objective-C and Rust types ---

NSString *_success(NSDictionary *value) {
  NSDictionary *wrapper = @{@"type": @"success", @"value": value};
  NSError *jsonError = nil;
  NSString *toReturn = serializeJson(wrapper, jsonError);

  if (jsonError) {
    // Manually format message since there seems to be an issue with the JSON serialization
    return [NSString stringWithFormat:@"{\"type\": \"error\", \"error\": \"Error occurred while serializing error: %@\"}", jsonError];
  }

  return toReturn;
}

NSString *_error(NSString *error) {
  NSDictionary *errorDictionary = @{@"type": @"error", @"error": error};
  NSError *jsonError = nil;
  NSString *toReturn = serializeJson(errorDictionary, jsonError);

  if (jsonError) {
    // Manually format message since there seems to be an issue with the JSON serialization
    return [NSString stringWithFormat:@"{\"type\": \"error\", \"error\": \"Error occurred while serializing error: %@\"}", jsonError];
  }

  return toReturn;
}

NSString *_error_er(NSError *error) {
  return _error([error localizedDescription]);
}

NSString *_error_ex(NSException *error) {
  return _error([NSString stringWithFormat:@"%@ (%@): %@", error.name, error.reason, [error callStackSymbols]]);
}

void _return(void* context, NSString *output) {
  if (!commandReturn(context, nsStringToObjCString(output))) {
    NSLog(@"Error: Failed to return command output");
    // NOTE: This will most likely crash the application
    @throw [NSException exceptionWithName:@"CommandReturnError" reason:@"Failed to return command output" userInfo:nil];
  }
}

/// Converts an NSString to an ObjCString struct
struct ObjCString nsStringToObjCString(NSString* string) {
  size_t size = [string lengthOfBytesUsingEncoding:NSUTF8StringEncoding] + 1;
  char *value = malloc(size);
  [string getCString:value maxLength:size encoding:NSUTF8StringEncoding];

  struct ObjCString objCString;
  objCString.value = value;
  objCString.size = size;

  return objCString;
}

/// Converts a C-string to an NSString
NSString* cStringToNSString(char* string) {
  return [[NSString alloc] initWithUTF8String:string];
}

