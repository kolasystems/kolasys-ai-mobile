//
//  SharedFilesBridge.m
//  KolasysAI
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SharedFilesBridge, NSObject)

RCT_EXTERN_METHOD(getPendingFiles:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deletePendingFile:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
