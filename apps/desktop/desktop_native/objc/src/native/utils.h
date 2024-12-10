#ifndef UTILS_H
#define UTILS_H

#import <Foundation/Foundation.h>

NSDictionary *parseJson(NSString *jsonString, NSError *error);
NSString *serializeJson(NSDictionary *dictionary, NSError *error);

NSData *decodeBase64URL(NSString *base64URLString);

#endif
