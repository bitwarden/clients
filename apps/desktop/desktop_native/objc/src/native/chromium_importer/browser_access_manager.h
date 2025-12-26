#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BrowserAccessManager : NSObject

- (instancetype)init;

/// Request access to a specific browser's directory
/// Returns security bookmark data (used to persist permissions) as base64 string, or nil if user declined
- (nullable NSString *)requestAccessToBrowserDir:(NSString *)browserName relativePath:(NSString *)relativePath;

/// Check if we have stored bookmark for browser (doesn't verify it's still valid)
- (BOOL)hasStoredAccess:(NSString *)browserName;

/// Start accessing a browser directory using stored bookmark
/// Returns the resolved path, or nil if bookmark is invalid/revoked
- (nullable NSString *)startAccessingBrowser:(NSString *)browserName;

/// Stop accessing a browser directory (must be called after startAccessingBrowser)
- (void)stopAccessingBrowser:(NSString *)browserName;

@end

NS_ASSUME_NONNULL_END
