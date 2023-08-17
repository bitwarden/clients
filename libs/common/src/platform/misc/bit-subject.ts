import { ReplaySubject } from "rxjs";

export class BitSubject<T = never> {
  private _subject = new ReplaySubject<T>(1);
  private _value: T;
  protected _initialized = false;

  next(value: T): void {
    this._initialized = true;

    this._value = value;
    this._subject.next(value);
  }

  get value(): T {
    if (!this._initialized) {
      throw new Error("Cannot call getValue on an uninitialized BitSubject");
    }

    return this._value;
  }

  asObservable() {
    return this._subject.asObservable();
  }
}
