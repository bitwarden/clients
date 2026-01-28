#import <Foundation/Foundation.h>
#import <CoreServices/CoreServices.h>
#import "../../interop.h"
#import "check_browser_installed.h"

void checkBrowserInstalledCommand(void* context, NSDictionary *params) {
  NSString *bundleId = params[@"bundleId"];

  if (!bundleId) {
    return _return(context, _error(@"Missing required parameter: bundleId"));
  }

  CFURLRef appURL = NULL;
  OSStatus status = LSFindApplicationForInfo(
    kLSUnknownCreator,
    (__bridge CFStringRef)bundleId,
    NULL,
    NULL,
    &appURL
  );

  BOOL isInstalled = (status == noErr && appURL != NULL);

  if (appURL != NULL) {
    CFRelease(appURL);
  }

  _return(context, _success(@{@"isInstalled": @(isInstalled)}));
}
