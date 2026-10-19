#ifndef APP_GROUP_H
#define APP_GROUP_H

#import "interop.h"

/// [Callable from Rust]
/// Returns the App Group identifier declared in the Info.plist of the app this process
/// belongs to (see `kAppGroupInfoKey`), or an empty string when the key is absent.
struct ObjCString appGroupId(void);

/// [Callable from Rust]
/// Returns the filesystem path of the shared App Group container for `groupId`, or an
/// empty string when the container cannot be resolved (for example a build that is not
/// entitled to the group).
struct ObjCString appGroupContainerPath(const char *groupId);

/// [Callable from Rust]
/// Returns the bundle identifier of the app this process belongs to (see `hostInfoDictionary`), or
/// an empty string when it has none (for example a binary that is not inside a bundle).
struct ObjCString appBundleIdentifier(void);

#endif
