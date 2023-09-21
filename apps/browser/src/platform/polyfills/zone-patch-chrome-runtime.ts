/**
 * Monkey patch `chrome.runtime.onMessage` event listeners to run in the Angular zone.
 */
Zone.__load_patch("ChromeRuntimeOnMessage", (global: any, Zone: ZoneType, api: _ZonePrivate) => {
  const onMessage = global.chrome.runtime.onMessage;
  if (typeof global?.chrome?.runtime?.onMessage === "undefined") {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  api.patchMethod(onMessage, "addListener", (delegate: Function) => (self: any, args: any[]) => {
    const callback = args.length > 0 ? args[0] : null;
    if (typeof callback === "function") {
      const wrapperedCallback = Zone.current.wrap(callback, "ChromeRuntimeOnMessage");
      callback[api.symbol("chromeRuntimeOnMessageCallback")] = wrapperedCallback;
      return delegate.call(self, wrapperedCallback);
    } else {
      return delegate.apply(self, args);
    }
  });

  // eslint-disable-next-line @typescript-eslint/ban-types
  api.patchMethod(onMessage, "removeListener", (delegate: Function) => (self: any, args: any[]) => {
    const callback = args.length > 0 ? args[0] : null;
    if (typeof callback === "function") {
      const wrapperedCallback = callback[api.symbol("chromeRuntimeOnMessageCallback")];
      if (wrapperedCallback) {
        return delegate.call(self, wrapperedCallback);
      } else {
        return delegate.apply(self, args);
      }
    } else {
      return delegate.apply(self, args);
    }
  });
});
