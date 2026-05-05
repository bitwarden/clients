#import <Foundation/Foundation.h>
#import "../../interop.h"
#import "../browser_access_manager.h"
#import "request_access.h"

void requestAccessCommand(void* context, NSDictionary *params) {
  NSString *browserName = params[@"browserName"];
  NSString *relativePath = params[@"relativePath"];
  NSString *pickerMessage = params[@"pickerMessage"];
  NSString *pickerExpectedLocationLabel = params[@"pickerExpectedLocationLabel"];
  NSString *pickerPrompt = params[@"pickerPrompt"];

  if (!browserName || !relativePath || !pickerMessage || !pickerExpectedLocationLabel || !pickerPrompt) {
    return _return(context, _error(@"Missing required parameters"));
  }

  BrowserAccessManager *manager = [BrowserAccessManager sharedManager];
  NSString *bookmarkData =
      [manager requestAccessToBrowserDir:browserName
                            relativePath:relativePath
                           pickerMessage:pickerMessage
             pickerExpectedLocationLabel:pickerExpectedLocationLabel
                            pickerPrompt:pickerPrompt];

  if (bookmarkData == nil) {
    return _return(context, _error(@"browserAccessDenied"));
  }

  _return(context, _success(@{@"bookmark": bookmarkData}));
}
