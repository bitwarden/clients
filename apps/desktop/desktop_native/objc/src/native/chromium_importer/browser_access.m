#import <Foundation/Foundation.h>
#import "browser_access.h"
#import "../utils.h"

#import "browser_access_manager.h"

static BrowserAccessManager* sharedManager = nil;

static BrowserAccessManager* getManager() {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[BrowserAccessManager alloc] init];
    });
    return sharedManager;
}

char* requestBrowserAccess(const char* browserName, const char* relativePath) {
    @autoreleasepool {
        NSString* name = [NSString stringWithUTF8String:browserName];
        NSString* path = [NSString stringWithUTF8String:relativePath];
        NSString* result = [getManager() requestAccessToBrowserDir:name relativePath:path];

        if (result == nil) {
            return NULL;
        }

        return strdup([result UTF8String]);
    }
}

bool hasStoredBrowserAccess(const char* browserName) {
    @autoreleasepool {
        NSString* name = [NSString stringWithUTF8String:browserName];
        return [getManager() hasStoredAccess:name];
    }
}

char* startBrowserAccess(const char* browserName) {
    @autoreleasepool {
        NSString* name = [NSString stringWithUTF8String:browserName];
        NSString* result = [getManager() startAccessingBrowser:name];
        
        if (result == nil) {
            return NULL;
        }
        
        return strdup([result UTF8String]);
    }
}

void stopBrowserAccess(const char* browserName) {
    @autoreleasepool {
        NSString* name = [NSString stringWithUTF8String:browserName];
        [getManager() stopAccessingBrowser:name];
    }
}