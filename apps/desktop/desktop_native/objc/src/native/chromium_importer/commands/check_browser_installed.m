#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "check_browser_installed.h"

void checkBrowserInstalledCommand(void* context, NSDictionary *params) {
  NSString *bundleId = params[@"bundleId"];

  if (!bundleId) {
    return _return(context, _error(@"Missing required parameter: bundleId"));
  }

  BOOL isInstalled = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:bundleId] != nil;

  _return(context, _success(@{@"isInstalled": @(isInstalled)}));
}
