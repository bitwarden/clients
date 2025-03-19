// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/**
 * Use as a Decorator on async functions, it will limit how many times the function can be
 * in-flight at a time.
 *
 * Calls beyond the limit will be queued, and run when one of the active calls finishes
 */
export function throttle(limit: number, throttleKey: (args: any[]) => string) {
  return <T>(
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>,
  ) => {
    const originalMethod: () => Promise<T> = descriptor.value;
    const allThrottles = new Map<any, Map<string, (() => void)[]>>();

    const getThrottles = (obj: any) => {
      let throttles = allThrottles.get(obj);
      if (throttles != null) {
        return throttles;
      }
      throttles = new Map<string, (() => void)[]>();
      allThrottles.set(obj, throttles);
      return throttles;
    };

    return {
      value: function (...args: any[]) {
        const throttles = getThrottles(this);
        const argsThrottleKey = throttleKey(args);
        let queue = throttles.get(argsThrottleKey);
        if (queue == null) {
          queue = [];
          throttles.set(argsThrottleKey, queue);
        }

        return new Promise<T>((resolve, reject) => {
          const exec = () => {
            const onFinally = () => {
              queue.splice(queue.indexOf(exec), 1);
              if (queue.length >= limit) {
                queue[limit - 1]();
              } else if (queue.length === 0) {
                throttles.delete(argsThrottleKey);
                if (throttles.size === 0) {
                  allThrottles.delete(this);
                }
              }
            };
            originalMethod
              .apply(this, args)
              .then((val: any) => {
                onFinally();
                return val;
              })
              .catch((err: any) => {
                onFinally();
                throw err;
              })
              .then(resolve, reject);
          };
          queue.push(exec);
          if (queue.length <= limit) {
            exec();
          }
        });
      },
    };
  };
}
