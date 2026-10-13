#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BrowserAccessManager : NSObject

/// Process-wide shared instance. Required so the NSURL produced by
/// `startAccessingBrowser:` can be retained across the separate ObjC command
/// invocations that pair `start` with `stop` — Apple's contract requires
/// `stopAccessingSecurityScopedResource` to be called on the same NSURL object
/// that was passed to `startAccessingSecurityScopedResource`.
+ (instancetype)sharedManager;

/// Request access to a specific browser's directory
/// Returns security bookmark data (used to persist permissions) as base64 string, or nil if user declined
/// All picker strings are pre-translated by the renderer (which has the i18n service); ObjC only
/// concatenates them with the resolved filesystem path it owns.
- (nullable NSString *)requestAccessToBrowserDir:(NSString *)browserName
                                    relativePath:(NSString *)relativePath
                                   pickerMessage:(NSString *)pickerMessage
                     pickerExpectedLocationLabel:(NSString *)pickerExpectedLocationLabel
                                    pickerPrompt:(NSString *)pickerPrompt;

/// Check if we have stored bookmark for browser (doesn't verify it's still valid)
- (BOOL)hasStoredAccess:(NSString *)browserName;

/// Start accessing a browser directory using stored bookmark
/// Returns the resolved path, or nil if bookmark is invalid/revoked
- (nullable NSString *)startAccessingBrowser:(NSString *)browserName;

/// Stop accessing a browser directory (must be called after startAccessingBrowser)
- (void)stopAccessingBrowser:(NSString *)browserName;

@end

NS_ASSUME_NONNULL_END
