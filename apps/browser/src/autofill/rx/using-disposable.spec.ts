import { NEVER, of, Subject, throwError } from "rxjs";

import { usingDisposable } from "./using-disposable";

class Resource implements Disposable {
  disposed = 0;
  [Symbol.dispose]() {
    this.disposed++;
  }
}

describe("usingDisposable", () => {
  it("hands the resource to the stream it builds", () => {
    const resource = new Resource();
    const values: Resource[] = [];

    usingDisposable(
      () => resource,
      (r) => of(r),
    ).subscribe((value) => values.push(value));

    expect(values).toEqual([resource]);
  });

  it("creates nothing until subscribed", () => {
    const create = jest.fn(() => new Resource());

    usingDisposable(create, () => NEVER);

    expect(create).not.toHaveBeenCalled();
  });

  it("creates a resource for each subscription", () => {
    const created: Resource[] = [];
    const stream$ = usingDisposable(
      () => {
        created.push(new Resource());
        return created[created.length - 1];
      },
      () => NEVER,
    );

    stream$.subscribe();
    stream$.subscribe();

    expect(created).toHaveLength(2);
  });

  it("keeps the resource while the stream runs", () => {
    const resource = new Resource();
    const source = new Subject<number>();

    usingDisposable(
      () => resource,
      () => source,
    ).subscribe();
    source.next(1);

    expect(resource.disposed).toBe(0);
  });

  it("disposes the resource when the stream completes", () => {
    const resource = new Resource();

    usingDisposable(
      () => resource,
      () => of(1),
    ).subscribe();

    expect(resource.disposed).toBe(1);
  });

  it("disposes the resource when the stream errors", () => {
    const resource = new Resource();

    usingDisposable(
      () => resource,
      () => throwError(() => new Error("nope")),
    ).subscribe({ error: () => undefined });

    expect(resource.disposed).toBe(1);
  });

  it("disposes the resource when the subscription ends", () => {
    const resource = new Resource();

    const subscription = usingDisposable(
      () => resource,
      () => NEVER,
    ).subscribe();
    subscription.unsubscribe();

    expect(resource.disposed).toBe(1);
  });

  it("disposes the resource when building the stream throws, and rethrows", () => {
    const resource = new Resource();
    const error = new Error("nope");
    const errors: unknown[] = [];

    usingDisposable(
      () => resource,
      () => {
        throw error;
      },
    ).subscribe({ error: (e: unknown) => errors.push(e) });

    expect(errors).toEqual([error]);
    expect(resource.disposed).toBe(1);
  });
});
