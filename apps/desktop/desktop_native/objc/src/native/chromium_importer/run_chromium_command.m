#import <Foundation/Foundation.h>
#import "commands/request_access.h"
#import "commands/has_stored_access.h"
#import "commands/start_access.h"
#import "commands/stop_access.h"
#import "commands/check_browser_installed.h"
#import "../interop.h"
#import "../utils.h"
#import "run_chromium_command.h"

void runChromiumCommand(void* context, NSDictionary *input) {
  NSString *command = input[@"command"];
  NSDictionary *params = input[@"params"];

  if ([command isEqual:@"request_access"]) {
    return requestAccessCommand(context, params);
  } else if ([command isEqual:@"has_stored_access"]) {
    return hasStoredAccessCommand(context, params);
  } else if ([command isEqual:@"start_access"]) {
    return startAccessCommand(context, params);
  } else if ([command isEqual:@"stop_access"]) {
    return stopAccessCommand(context, params);
  } else if ([command isEqual:@"check_browser_installed"]) {
    return checkBrowserInstalledCommand(context, params);
  }

  _return(context, _error([NSString stringWithFormat:@"Unknown command: %@", command]));
}
