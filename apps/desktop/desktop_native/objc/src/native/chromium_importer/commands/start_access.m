#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "../browser_access_manager.h"
#import "start_access.h"

void startAccessCommand(void* context, NSDictionary *params) {
  NSString *browserName = params[@"browserName"];

  if (!browserName) {
    return _return(context, _error(@"Missing required parameter: browserName"));
  }

  BrowserAccessManager *manager = [[BrowserAccessManager alloc] init];
  NSString *resolvedPath = [manager startAccessingBrowser:browserName];

  if (resolvedPath == nil) {
    return _return(context, _error(@"Failed to start accessing browser. Bookmark may be invalid or revoked"));
  }

  _return(context, _success(@{@"path": resolvedPath}));
}
