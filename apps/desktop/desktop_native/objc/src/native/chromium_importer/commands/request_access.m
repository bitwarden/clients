#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "../browser_access_manager.h"
#import "request_access.h"

void requestAccessCommand(void* context, NSDictionary *params) {
  NSString *browserName = params[@"browserName"];
  NSString *relativePath = params[@"relativePath"];

  if (!browserName || !relativePath) {
    return _return(context, _error(@"Missing required parameters: browserName and relativePath"));
  }

  BrowserAccessManager *manager = [[BrowserAccessManager alloc] init];
  NSString *bookmarkData = [manager requestAccessToBrowserDir:browserName relativePath:relativePath];

  if (bookmarkData == nil) {
    return _return(context, _error(@"browserAccessDenied"));
  }

  _return(context, _success(@{@"bookmark": bookmarkData}));
}
