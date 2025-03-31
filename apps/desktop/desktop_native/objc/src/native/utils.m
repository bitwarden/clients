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
  NSString *base64String = [base64URLString stringByReplacingOccurrencesOfString:@"-" withString:@"+"];
  base64String = [base64String stringByReplacingOccurrencesOfString:@"_" withString:@"/"];

  NSData *nsdataFromBase64String = [[NSData alloc]
    initWithBase64EncodedString:base64String options:0];

  return nsdataFromBase64String;
}
