#import <Foundation/Foundation.h>
#import "commands/status.h"
#import "commands/sync.h"
#import "interop.h"
#import "utils.h"

// Tips for developing Objective-C code:
// - Use the `NSLog` function to log messages to the system log
//   - Example:
//     NSLog(@"An example log: %@", someVariable);
// - Use the `@try` and `@catch` directives to catch exceptions

#if !__has_feature(objc_arc)
  // Auto Reference Counting makes memory management easier for Objective-C objects
  // Regular C objects still need to be managed manually
  #error ARC must be enabled!
#endif

void pickAndRunCommand(void* context, NSDictionary *input) {
  NSString *command = input[@"command"];
  NSDictionary *params = input[@"params"];

  if ([command isEqual:@"status"]) {
    return status(context, params);
  } else if ([command isEqual:@"sync"]) {
    return runSync(context, params);
  }

  _return(context, _error([NSString stringWithFormat:@"Unknown command: %@", command]));
}

/// [Callable from Rust]
/// Runs a command with the given input JSON
/// This function is called from Rust and is the entry point for running Objective-C code.
/// It takes a JSON string as input, deserializes it, runs the command, and serializes the output.
/// It also catches any exceptions that occur during the command execution.
void runCommand(void *context, char* inputJson) {
  @autoreleasepool {
    @try {
      NSString *inputString = cStringToNSString(inputJson);

      NSError *error = nil;
      NSDictionary *input = parseJson(inputString, error);
      if (error) {
        NSLog(@"Error occured while deserializing input params: %@", error);
        return _return(context, _error([NSString stringWithFormat:@"Error occured while deserializing input params: %@", error]));
      }

      pickAndRunCommand(context, input);
    } @catch (NSException *e) {
      NSLog(@"Error occurred while running Objective-C command: %@", e);
      _return(context, _error([NSString stringWithFormat:@"Error occurred while running Objective-C command: %@", e]));
    }
  }
}
