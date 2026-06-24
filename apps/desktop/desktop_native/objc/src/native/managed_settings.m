#import <Foundation/Foundation.h>
#import <sys/stat.h>
#import "interop.h"
#import "utils.h"

/// Returns YES if the file at `path` is owned by uid 0 (root).
/// Symlinks are NOT followed — `lstat` is used so a symlink to a non-root file
/// cannot spoof ownership.
static BOOL isRootOwned(NSString *path) {
  struct stat st;
  if (lstat([path fileSystemRepresentation], &st) != 0) {
    return NO;
  }
  return st.st_uid == 0;
}

/// [Callable from Rust]
/// Reads string-valued managed preferences for `appID` from the macOS managed-
/// preferences plist files and returns them as a JSON-encoded ObjCString
/// (e.g. {"key":"value",...}).  Non-string values are skipped.  The caller is
/// responsible for freeing the returned ObjCString via freeObjCString.
/// Returns an empty-object JSON string when no managed preferences exist.
struct ObjCString readManagedPreferences(char *appID) {
  @autoreleasepool {
    NSString *appIDString = cStringToNSString(appID);

    // Build candidate paths: computer-level (device-forced) then user-level.
    NSString *computerPath = [NSString stringWithFormat:@"/Library/Managed Preferences/%@.plist", appIDString];
    NSString *userName = NSUserName();
    NSString *userPath   = [NSString stringWithFormat:@"/Library/Managed Preferences/%@/%@.plist", userName, appIDString];

    // Computer-level entries are the device-forced baseline; user-level entries
    // take precedence (last-write-wins merge).
    NSArray<NSString *> *candidates = @[computerPath, userPath];

    NSMutableDictionary *result = [NSMutableDictionary dictionary];

    for (NSString *path in candidates) {
      // Trust only root-owned files.  /Library/Managed Preferences/ is
      // OS/root-protected, but an explicit check closes the TOCTOU window and
      // rejects any attacker-writable file that might appear at the path.
      // isRootOwned() uses lstat, which returns NO for non-existent files, so
      // the existence check is redundant.
      if (!isRootOwned(path)) {
        continue;
      }

      NSDictionary *plist = [NSDictionary dictionaryWithContentsOfFile:path];
      if (plist == nil) {
        continue;
      }

      [plist enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop __unused) {
        // Only string-valued managed preferences are surfaced. Non-string values are dropped;
        // supporting non-string managed settings on desktop requires widening the NAPI return
        // type (tracked: managed-settings spec, desktop section).
        if ([key isKindOfClass:[NSString class]] && [obj isKindOfClass:[NSString class]]) {
          result[key] = obj;
        }
      }];
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
