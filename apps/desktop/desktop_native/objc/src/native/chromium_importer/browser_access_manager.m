#import "browser_access_manager.h"
#import <Cocoa/Cocoa.h>

@implementation BrowserAccessManager {
    NSString *_bookmarkKey;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _bookmarkKey = @"com.bitwarden.chromiumImporter.bookmarks";
    }
    return self;
}

- (NSString *)requestAccessToBrowserDir:(NSString *)browserName relativePath:(NSString *)relativePath {

    if (!relativePath) {
        return nil;
    }

    NSURL *homeDir = [[NSFileManager defaultManager] homeDirectoryForCurrentUser];
    NSURL *browserPath = [homeDir URLByAppendingPathComponent:relativePath];

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

        panelResult = [openPanel runModal];
        selectedURL = openPanel.URL;
    };

    if ([NSThread isMainThread]) {
        showPanel();
    } else {
        dispatch_sync(dispatch_get_main_queue(), showPanel);
    }

    if (panelResult != NSModalResponseOK || !selectedURL) {
        return nil;
    }

    // Compare the selected path against the expected browser directory
    NSString *expectedPath = browserPath.path;
    NSString *selectedPath = selectedURL.path;
    if (![selectedPath isEqualToString:expectedPath]) {
        return nil;
    }

    // Validate the selected directory contains a Local State file
    NSURL *localStatePath = [selectedURL URLByAppendingPathComponent:@"Local State"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:localStatePath.path]) {
        return nil;
    }

    // Validate Local State contains expected Chromium structure
    NSData *localStateData = [NSData dataWithContentsOfURL:localStatePath];
    if (!localStateData) {
        return nil;
    }
    NSError *jsonError = nil;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:localStateData options:0 error:&jsonError];
    if (!jsonObject || ![jsonObject isKindOfClass:[NSDictionary class]]) {
        return nil;
    }

    NSDictionary *localState = (NSDictionary *)jsonObject;

    // Verify essential Chromium/Chrome keys exist to confirm this is actually a browser data directory
    if (!localState[@"profile"] && !localState[@"browser"]) {
        return nil;
    }

    // Access is temporary right now, persist it by creating a security bookmark
    NSError *error = nil;
    NSData *bookmarkData = [selectedURL bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                                            includingResourceValuesForKeys:nil
                                            relativeToURL:nil
                                            error:&error];

    if (!bookmarkData) {
        return nil;
    }

    [self saveBookmark:bookmarkData forBrowser:browserName];
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
        return nil;
    }

    if (isStale) {
        NSData *newBookmarkData = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                                            includingResourceValuesForKeys:nil
                                            relativeToURL:nil
                                            error:&error];

        if (!newBookmarkData) {
            return nil;
        }

        [self saveBookmark:newBookmarkData forBrowser:browserName];
    }

    if (![url startAccessingSecurityScopedResource]) {
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
}

- (NSData *)loadBookmarkForBrowser:(NSString *)browserName {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSString *key = [self bookmarkKeyFor:browserName];
    return [defaults dataForKey:key];
}

@end
