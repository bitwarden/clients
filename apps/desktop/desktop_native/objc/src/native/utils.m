#import "utils.h"

NSDictionary *parseJson(NSString *jsonString, NSError *error) {
  NSData *data = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  if (error) {
    return nil;
  }
  return json;
}

NSString *serializeJson(NSDictionary *dictionary, NSError *error) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:dictionary options:0 error:&error];
  if (error) {
    return nil;
  }
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

NSData *decodeBase64URL(NSString *base64URLString) {
  if (base64URLString.length == 0) {
    return nil;
  }
  
  // Replace URL-safe characters with standard base64 characters
  NSString *base64String = [base64URLString stringByReplacingOccurrencesOfString:@"-" withString:@"+"];
  base64String = [base64String stringByReplacingOccurrencesOfString:@"_" withString:@"/"];
  
  // Add padding if needed
  // Base 64 strings should be a multiple of 4 in length
  NSUInteger paddingLength = 4 - (base64String.length % 4);
  if (paddingLength < 4) {
    NSMutableString *paddedString = [NSMutableString stringWithString:base64String];
    for (NSUInteger i = 0; i < paddingLength; i++) {
      [paddedString appendString:@"="];
    }
    base64String = paddedString;
  }
  
  // Decode the string
  NSData *nsdataFromBase64String = [[NSData alloc]
    initWithBase64EncodedString:base64String options:0];

  return nsdataFromBase64String;
}
