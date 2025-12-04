#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "../browser_access_manager.h"
#import "stop_access.h"

void stopAccessCommand(void* context, NSDictionary *params) {
  NSString *browserName = params[@"browserName"];

  if (!browserName) {
    return _return(context, _error(@"Missing required parameter: browserName"));
  }

  BrowserAccessManager *manager = [[BrowserAccessManager alloc] init];
  [manager stopAccessingBrowser:browserName];

  _return(context, _success(@{}));
}
