#import <Foundation/Foundation.h>
#import "autofill/run_autofill_command.h"
#import "interop.h"
#import "utils.h"

void pickAndRunCommand(void* context, NSDictionary *input) {
  NSString *namespace = input[@"namespace"];

  if ([namespace isEqual:@"autofill"]) {
    return runAutofillCommand(context, input);
  }

  _return(context, _error([NSString stringWithFormat:@"Unknown namespace: %@", namespace]));
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
