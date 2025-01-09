// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// Wrapper for a promise that we can await the promise in one case
// while allowing an unrelated event to fulfill it elsewhere.
export default class Deferred<T> {
  private promise: Promise<T>;
  private resolver: (T?) => void;
  private rejecter: (Error?) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  resolve(value?: T) {
    this.resolver(value);
  }

  reject(error?: Error) {
    this.rejecter(error);
  }

  getPromise(): Promise<T> {
    return this.promise;
  }
}
