#import "app_group.h"

/// The Info.plist key carrying the App Group identifier shared between the desktop app
/// and the macOS autofill extension. It is stamped per build variant so a single native
/// binary serves both production and beta without recompilation.
static NSString *const kAppGroupInfoKey = @"BitwardenAppGroupIdentifier";

struct ObjCString appGroupId(void) {
  NSString *groupId = [[NSBundle mainBundle] objectForInfoDictionaryKey:kAppGroupInfoKey];
  return nsStringToObjCString(groupId.length > 0 ? groupId : @"");
}

struct ObjCString appGroupContainerPath(const char *groupId) {
  NSString *group = [[NSString alloc] initWithUTF8String:groupId];
  NSURL *containerURL = [[NSFileManager defaultManager]
      containerURLForSecurityApplicationGroupIdentifier:group];
  return nsStringToObjCString(containerURL ? containerURL.path : @"");
}
