#import <CoreFoundation/CoreFoundation.h>
#import "interop.h"
#import "utils.h"

/// [Callable from Rust]
/// Reads string-valued managed preferences for `appID` and returns them as a
/// JSON-encoded ObjCString (e.g. {"key":"value",...}). Non-string values are
/// skipped. The caller is responsible for freeing the returned ObjCString via
/// freeObjCString. Returns an empty-object JSON string when no keys exist.
struct ObjCString readManagedPreferences(char *appID) {
  @autoreleasepool {
    NSString *appIDString = cStringToNSString(appID);
    CFStringRef cfAppID = (__bridge CFStringRef)appIDString;

    CFArrayRef keys = CFPreferencesCopyKeyList(
      cfAppID,
      kCFPreferencesCurrentUser,
      kCFPreferencesAnyHost
    );

    NSMutableDictionary *result = [NSMutableDictionary dictionary];

    if (keys != NULL) {
      CFIndex count = CFArrayGetCount(keys);
      for (CFIndex i = 0; i < count; i++) {
        CFStringRef cfKey = (CFStringRef)CFArrayGetValueAtIndex(keys, i);
        CFPropertyListRef cfValue = CFPreferencesCopyAppValue(cfKey, cfAppID);
        if (cfValue != NULL) {
          if (CFGetTypeID(cfValue) == CFStringGetTypeID()) {
            NSString *key = (__bridge NSString *)cfKey;
            NSString *value = (__bridge_transfer NSString *)cfValue;
            result[key] = value;
          } else {
            CFRelease(cfValue);
          }
        }
      }
      CFRelease(keys);
    }

    NSError *jsonError = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:&jsonError];
    NSString *output;
    if (jsonError || data == nil) {
      output = @"{}";
    } else {
      output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      if (output == nil) {
        output = @"{}";
      }
    }

    return nsStringToObjCString(output);
  }
}
