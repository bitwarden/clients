import { BitSubject } from "./bit-subject";

describe("BitSubject", () => {
  it("should error if value is accessed before being initialized", () => {
    const subject = new BitSubject();
    expect(() => subject.value).toThrowError("Cannot call getValue on an uninitialized BitSubject");
  });

  it("should return the value if initialized", () => {
    const subject = new BitSubject<number>();
    subject.next(1);
    expect(subject.value).toBe(1);
  });

  it("should return the value if initialized with a falsy value", () => {
    const subject = new BitSubject<void>();
    subject.next();
    expect(subject.value).toBe(undefined);
  });

  it("should call next on the underlying subject", () => {
    const subject = new BitSubject<number>();
    const spy = jest.spyOn(subject["_subject"], "next");
    subject.next(1);
    expect(spy).toHaveBeenCalledWith(1);
  });
});
