#import "app_group.h"

/// The Info.plist key carrying the App Group identifier shared between the desktop app
/// and the macOS autofill extension. It is stamped per build variant so a single native
/// binary serves both production and beta without recompilation.
static NSString *const kAppGroupInfoKey = @"BitwardenAppGroupIdentifier";

/// The Info.plist of the app this process belongs to.
///
/// For the app and for the extension that is the main bundle's. desktop_proxy embeds its own
/// Info.plist (resources/info.desktop_proxy.plist), and Foundation builds the main bundle's info
/// dictionary from that rather than from the app's, so for it read the enclosing .app's
/// Contents/Info.plist directly.
static NSDictionary *hostInfoDictionary(void) {
  NSBundle *mainBundle = [NSBundle mainBundle];
  if ([mainBundle objectForInfoDictionaryKey:kAppGroupInfoKey] != nil) {
    return mainBundle.infoDictionary;
  }

  NSString *path = [mainBundle.executablePath stringByResolvingSymlinksInPath];
  while (path.length > 1) {
    path = [path stringByDeletingLastPathComponent];
    if ([path.pathExtension isEqualToString:@"app"]) {
      NSURL *infoPlist = [NSURL fileURLWithPath:[path stringByAppendingPathComponent:@"Contents/Info.plist"]];
      return [NSDictionary dictionaryWithContentsOfURL:infoPlist error:nil] ?: mainBundle.infoDictionary;
    }
  }
  return mainBundle.infoDictionary;
}

struct ObjCString appGroupId(void) {
  id groupId = hostInfoDictionary()[kAppGroupInfoKey];
  return nsStringToObjCString([groupId isKindOfClass:[NSString class]] && [groupId length] > 0 ? groupId : @"");
}

struct ObjCString appGroupContainerPath(const char *groupId) {
  NSString *group = [[NSString alloc] initWithUTF8String:groupId];
  NSURL *containerURL = [[NSFileManager defaultManager]
      containerURLForSecurityApplicationGroupIdentifier:group];
  return nsStringToObjCString(containerURL ? containerURL.path : @"");
}
