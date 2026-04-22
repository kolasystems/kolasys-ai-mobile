#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(WatchBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(activate)
RCT_EXTERN_METHOD(sendState:(NSString *)state elapsed:(NSInteger)elapsed)

@end
