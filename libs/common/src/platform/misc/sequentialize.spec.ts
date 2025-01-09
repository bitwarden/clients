import { clearCaches, sequentialize } from "./sequentialize";

describe("sequentialize decorator", () => {
  it("should call the function once", async () => {
    const foo = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.bar(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(1);
  });

  it("should call the function once for each instance of the object", async () => {
    const foo = new Foo();
    const foo2 = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.bar(1));
      promises.push(foo2.bar(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(1);
    expect(foo2.calls).toBe(1);
  });

  it("should call the function once with key function", async () => {
    const foo = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.baz(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(1);
  });

  it("should call the function again when already resolved", async () => {
    const foo = new Foo();
    await foo.bar(1);
    expect(foo.calls).toBe(1);
    await foo.bar(1);
    expect(foo.calls).toBe(2);
  });

  it("should call the function again when already resolved with a key function", async () => {
    const foo = new Foo();
    await foo.baz(1);
    expect(foo.calls).toBe(1);
    await foo.baz(1);
    expect(foo.calls).toBe(2);
  });

  it("should call the function for each argument", async () => {
    const foo = new Foo();
    await Promise.all([foo.bar(1), foo.bar(1), foo.bar(2), foo.bar(2), foo.bar(3), foo.bar(3)]);
    expect(foo.calls).toBe(3);
  });

  it("should call the function for each argument with key function", async () => {
    const foo = new Foo();
    await Promise.all([foo.baz(1), foo.baz(1), foo.baz(2), foo.baz(2), foo.baz(3), foo.baz(3)]);
    expect(foo.calls).toBe(3);
  });

  it("should return correct result for each call", async () => {
    const foo = new Foo();
    const allRes: number[] = [];

    await Promise.all([
      foo.bar(1).then((res) => allRes.push(res)),
      foo.bar(1).then((res) => allRes.push(res)),
      foo.bar(2).then((res) => allRes.push(res)),
      foo.bar(2).then((res) => allRes.push(res)),
      foo.bar(3).then((res) => allRes.push(res)),
      foo.bar(3).then((res) => allRes.push(res)),
    ]);
    expect(foo.calls).toBe(3);
    expect(allRes.length).toBe(6);
    allRes.sort();
    expect(allRes).toEqual([2, 2, 4, 4, 6, 6]);
  });

  it("should return correct result for each call with key function", async () => {
    const foo = new Foo();
    const allRes: number[] = [];

    await Promise.all([
      foo.baz(1).then((res) => allRes.push(res)),
      foo.baz(1).then((res) => allRes.push(res)),
      foo.baz(2).then((res) => allRes.push(res)),
      foo.baz(2).then((res) => allRes.push(res)),
      foo.baz(3).then((res) => allRes.push(res)),
      foo.baz(3).then((res) => allRes.push(res)),
    ]);
    expect(foo.calls).toBe(3);
    expect(allRes.length).toBe(6);
    allRes.sort();
    expect(allRes).toEqual([3, 3, 6, 6, 9, 9]);
  });

  describe("clearCaches", () => {
    it("should clear all caches", async () => {
      const foo = new Foo();
      const promise = Promise.all([foo.bar(1), foo.bar(1)]);
      clearCaches();
      await foo.bar(1);
      await promise;
      // one call for the first two, one for the third after the cache was cleared
      expect(foo.calls).toBe(2);
    });
  });
});

class Foo {
  calls = 0;

  @sequentialize((args) => "bar" + args[0])
  bar(a: number): Promise<number> {
    this.calls++;
    return new Promise((res) => {
      setTimeout(() => {
        res(a * 2);
      }, Math.random() * 100);
    });
  }

  @sequentialize((args) => "baz" + args[0])
  baz(a: number): Promise<number> {
    this.calls++;
    return new Promise((res) => {
      setTimeout(() => {
        res(a * 3);
      }, Math.random() * 100);
    });
  }
}
