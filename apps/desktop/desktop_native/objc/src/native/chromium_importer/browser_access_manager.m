#import "BrowserAccessManager.h"
#import <Cocoa/Cocoa.h>

@implementation BrowserAccessManager {
    NSString *_bookmarkKey;
    NSDictionary<NSString *, NSString *> *_browserPaths;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _bookmarkKey = @"com.bitwarden.chromiumImporter.bookmarks";

        _browserPaths = @{
            @"Chrome": @"Library/Application Support/Google/Chrome",
            @"Chromium": @"Library/Application Support/Chromium",
            @"Microsoft Edge": @"Library/Application Support/Microsoft Edge",
            @"Brave": @"Library/Application Support/BraveSoftware/Brave-Browser",
            @"Arc": @"Library/Application Support/Arc/User Data",
            @"Opera": @"Library/Application Support/com.operasoftware.Opera",
            @"Vivaldi": @"Library/Application Support/Vivaldi"
        };
    }
    return self;
}

- (NSString *)requestAccessToBrowserDir:(NSString *)browserName {
    // NSLog(@"[OBJC] requestAccessToBrowserDir called for: %@", browserName);

    NSString *relativePath = _browserPaths[browserName];
    if (!relativePath) {
        // NSLog(@"[OBJC] Unknown browser: %@", browserName);
        return nil;
    }

    NSURL *homeDir = [[NSFileManager defaultManager] homeDirectoryForCurrentUser];
    NSURL *browserPath = [homeDir URLByAppendingPathComponent:relativePath];

    // NSLog(@"[OBJC] Browser path: %@", browserPath.path);

    // NSOpenPanel must be run on the main thread
    __block NSURL *selectedURL = nil;
    __block NSModalResponse panelResult = NSModalResponseCancel;

    void (^showPanel)(void) = ^{
        NSOpenPanel *openPanel = [NSOpenPanel openPanel];
        openPanel.message = [NSString stringWithFormat:
            @"Please select your %@ data folder\n\nExpected location:\n%@",
            browserName, browserPath.path];
        openPanel.prompt = @"Grant Access";
        openPanel.allowsMultipleSelection = NO;
        openPanel.canChooseDirectories = YES;
        openPanel.canChooseFiles = NO;
        openPanel.directoryURL = browserPath;

        // NSLog(@"[OBJC] About to call runModal");
        panelResult = [openPanel runModal];
        selectedURL = openPanel.URL;
        // NSLog(@"[OBJC] runModal returned: %ld", (long)panelResult);
    };

    if ([NSThread isMainThread]) {
        // NSLog(@"[OBJC] Already on main thread");
        showPanel();
    } else {
        // NSLog(@"[OBJC] Dispatching to main queue...");
        dispatch_sync(dispatch_get_main_queue(), showPanel);
    }

    if (panelResult != NSModalResponseOK || !selectedURL) {
        // NSLog(@"[OBJC] User cancelled access request or panel failed");
        return nil;
    }

    // NSLog(@"[OBJC] User selected URL: %@", selectedURL.path);

    NSURL *localStatePath = [selectedURL URLByAppendingPathComponent:@"Local State"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:localStatePath.path]) {
        // NSLog(@"[OBJC] Selected folder doesn't appear to be a valid %@ directory", browserName);

        NSAlert *alert = [[NSAlert alloc] init];
        alert.messageText = @"Invalid Folder";
        alert.informativeText = [NSString stringWithFormat:
            @"The selected folder doesn't appear to be a valid %@ data directory. Please select the correct folder.",
            browserName];
        alert.alertStyle = NSAlertStyleWarning;
        [alert runModal];

        return nil;
    }

    // Access is temporary right now, persist it by creating a security bookmark
    NSError *error = nil;
    NSData *bookmarkData = [selectedURL bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                                            includingResourceValuesForKeys:nil
                                            relativeToURL:nil
                                            error:&error];

    if (!bookmarkData) {
        // NSLog(@"[OBJC] Failed to create bookmark: %@", error);
        return nil;
    }

    [self saveBookmark:bookmarkData forBrowser:browserName];
    // NSLog(@"[OBJC] Successfully created and saved bookmark");
    return [bookmarkData base64EncodedStringWithOptions:0];
}

- (BOOL)hasStoredAccess:(NSString *)browserName {
    return [self loadBookmarkForBrowser:browserName] != nil;
}

- (NSString *)startAccessingBrowser:(NSString *)browserName {
    NSData *bookmarkData = [self loadBookmarkForBrowser:browserName];
    if (!bookmarkData) {
        return nil;
    }

    BOOL isStale = NO;
    NSError *error = nil;
    NSURL *url = [NSURL URLByResolvingBookmarkData:bookmarkData
                            options:NSURLBookmarkResolutionWithSecurityScope
                            relativeToURL:nil
                            bookmarkDataIsStale:&isStale
                            error:&error];

    if (!url) {
        // NSLog(@"Failed to resolve bookmark: %@", error);
        return nil;
    }

    if (isStale) {
        // NSLog(@"Security bookmark for %@ is stale, attempting to re-create it", browserName);
        NSData *newBookmarkData = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                                            includingResourceValuesForKeys:nil
                                            relativeToURL:nil
                                            error:&error];

        if (!newBookmarkData) {
            // NSLog(@"Failed to create bookmark: %@", error);
            return nil;
        }

        [self saveBookmark:newBookmarkData forBrowser:browserName];
    }

    if (![url startAccessingSecurityScopedResource]) {
        // NSLog(@"Failed to start accessing security-scoped resource");
        return nil;
    }

    return url.path;
}

- (void)stopAccessingBrowser:(NSString *)browserName {
    NSData *bookmarkData = [self loadBookmarkForBrowser:browserName];
    if (!bookmarkData) {
        return;
    }

    BOOL isStale = NO;
    NSError *error = nil;
    NSURL *url = [NSURL URLByResolvingBookmarkData:bookmarkData
                                options:NSURLBookmarkResolutionWithSecurityScope
                                relativeToURL:nil
                                bookmarkDataIsStale:&isStale
                                error:&error];

    if (!url) {
        // NSLog(@"Failed to resolve bookmark for stop: %@", error);
        return;
    }

    [url stopAccessingSecurityScopedResource];
}

#pragma mark - Private Methods

- (NSString *)bookmarkKeyFor:(NSString *)browserName {
    return [NSString stringWithFormat:@"%@.%@", _bookmarkKey, browserName];
}

- (void)saveBookmark:(NSData *)data forBrowser:(NSString *)browserName {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self bookmarkKeyFor:browserName];
    [defaults setObject:data forKey:key];
    [defaults synchronize];
}

- (NSData *)loadBookmarkForBrowser:(NSString *)browserName {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self bookmarkKeyFor:browserName];
    return [defaults dataForKey:key];
}

@end
