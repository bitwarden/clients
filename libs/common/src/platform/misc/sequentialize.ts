// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
const caches = new Map<any, Map<string, Promise<any>>>();

const getCache = (obj: any) => {
  let cache = caches.get(obj);
  if (cache != null) {
    return cache;
  }
  cache = new Map<string, Promise<any>>();
  caches.set(obj, cache);
  return cache;
};

export function clearCaches() {
  caches.clear();
}

/**
 * Use as a Decorator on async functions, it will prevent multiple 'active' calls as the same time
 *
 * If a promise was returned from a previous call to this function, that hasn't yet resolved it will
 * be returned, instead of calling the original function again
 *
 * Results are not cached, once the promise has returned, the next call will result in a fresh call
 *
 * Read more at https://github.com/bitwarden/jslib/pull/7
 */
export function sequentialize(cacheKey: (args: any[]) => string) {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod: () => Promise<any> = descriptor.value;

    return {
      value: function (...args: any[]) {
        const cache = getCache(this);
        const argsCacheKey = cacheKey(args);
        let response = cache.get(argsCacheKey);
        if (response != null) {
          return response;
        }

        const onFinally = () => {
          cache.delete(argsCacheKey);
          if (cache.size === 0) {
            caches.delete(this);
          }
        };
        response = originalMethod
          .apply(this, args)
          .then((val: any) => {
            onFinally();
            return val;
          })
          .catch((err: any) => {
            onFinally();
            throw err;
          });

        cache.set(argsCacheKey, response);
        return response;
      },
    };
  };
}
