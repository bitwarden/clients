#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "../browser_access_manager.h"
#import "has_stored_access.h"

void hasStoredAccessCommand(void* context, NSDictionary *params) {
  NSString *browserName = params[@"browserName"];

  if (!browserName) {
    return _return(context, _error(@"Missing required parameter: browserName"));
  }

  BrowserAccessManager *manager = [[BrowserAccessManager alloc] init];
  BOOL hasAccess = [manager hasStoredAccess:browserName];

  _return(context, _success(@{@"hasAccess": @(hasAccess)}));
}
