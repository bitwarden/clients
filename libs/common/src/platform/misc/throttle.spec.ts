import { throttle } from "./throttle";

describe("throttle decorator", () => {
  it("should call the function once at a time", async () => {
    const foo = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.bar(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(10);
  });

  it("should call the function once at a time for each object", async () => {
    const foo = new Foo();
    const foo2 = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.bar(1));
      promises.push(foo2.bar(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(10);
    expect(foo2.calls).toBe(10);
  });

  it("should call the function limit at a time", async () => {
    const foo = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.baz(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(10);
  });

  it("should call the function limit at a time for each object", async () => {
    const foo = new Foo();
    const foo2 = new Foo();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(foo.baz(1));
      promises.push(foo2.baz(1));
    }
    await Promise.all(promises);

    expect(foo.calls).toBe(10);
    expect(foo2.calls).toBe(10);
  });
});

class Foo {
  calls = 0;
  inflight = 0;

  @throttle(1, () => "bar")
  bar(a: number) {
    this.calls++;
    this.inflight++;
    return new Promise((res) => {
      setTimeout(() => {
        expect(this.inflight).toBe(1);
        this.inflight--;
        res(a * 2);
      }, Math.random() * 10);
    });
  }

  @throttle(5, () => "baz")
  baz(a: number) {
    this.calls++;
    this.inflight++;
    return new Promise((res) => {
      setTimeout(() => {
        expect(this.inflight).toBeLessThanOrEqual(5);
        this.inflight--;
        res(a * 3);
      }, Math.random() * 10);
    });
  }

  @throttle(1, () => "qux")
  qux(a: number) {
    this.calls++;
    this.inflight++;
    return new Promise((res) => {
      setTimeout(() => {
        expect(this.inflight).toBe(1);
        this.inflight--;
        res(a * 3);
      }, Math.random() * 10);
    });
  }
}
