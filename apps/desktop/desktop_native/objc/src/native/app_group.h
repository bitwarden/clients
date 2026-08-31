#ifndef APP_GROUP_H
#define APP_GROUP_H

#import "interop.h"

/// [Callable from Rust]
/// Returns the App Group identifier declared in this process's Info.plist (see
/// `kAppGroupInfoKey`), or an empty string when the key is absent.
struct ObjCString appGroupId(void);

/// [Callable from Rust]
/// Returns the filesystem path of the shared App Group container for `groupId`, or an
/// empty string when the container cannot be resolved (for example a build that is not
/// entitled to the group).
struct ObjCString appGroupContainerPath(const char *groupId);

#endif
