#import <Foundation/Foundation.h>
#import "commands/sync.h"
#import "commands/status.h"
#import "../interop.h"
#import "../utils.h"
#import "run_autofill_command.h"

void runAutofillCommand(void* context, NSDictionary *input) {
  NSString *command = input[@"command"];
  NSDictionary *params = input[@"params"];

  if ([command isEqual:@"status"]) {
    return status(context, params);
  } else if ([command isEqual:@"sync"]) {
    return runSync(context, params);
  }

  _return(context, _error([NSString stringWithFormat:@"Unknown command: %@", command]));
}

