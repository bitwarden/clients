// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export const race = <T>({
  promise,
  timeout,
  error,
}: {
  promise: Promise<T>;
  timeout: number;
  error?: Error;
}) => {
  let timer = null;

  // Similar to Promise.all, but instead of waiting for all, it resolves once one promise finishes.
  // Using this so we can reject if the timeout threshold is hit
  return Promise.race([
    new Promise<T>((_, reject) => {
      timer = setTimeout(reject, timeout, error);
      return timer;
    }),

    promise.then((value) => {
      clearTimeout(timer);
      return value;
    }),
  ]);
};
