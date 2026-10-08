import { NEVER, Subject, Subscription } from "rxjs";

import { AccessEventService } from "..";

import { DefaultAccessRefreshService } from "./default-access-refresh.service";

describe("DefaultAccessRefreshService", () => {
  let service: DefaultAccessRefreshService;
  let push$: Subject<void>;
  const subscriptions: Subscription[] = [];

  /** Counts emissions for one cipher, so tests read as "how many re-reads did this trigger". */
  function watch(cipherId: string): () => number {
    let count = 0;
    subscriptions.push(service.accessChanged$(cipherId).subscribe(() => (count += 1)));
    return () => count;
  }

  beforeEach(() => {
    push$ = new Subject<void>();
    const accessEvents: AccessEventService = {
      accessChanged$: () => push$.asObservable(),
      approverInboxChanged$: () => NEVER,
    };
    service = new DefaultAccessRefreshService(accessEvents);
  });

  afterEach(() => {
    subscriptions.forEach((s) => s.unsubscribe());
    subscriptions.length = 0;
  });

  it("notifies the named cipher's subscribers", () => {
    const cipherOne = watch("cipher-1");

    service.notifyAccessChanged("cipher-1");

    expect(cipherOne()).toBe(1);
  });

  it("does not notify a different cipher", () => {
    const cipherTwo = watch("cipher-2");

    service.notifyAccessChanged("cipher-1");

    expect(cipherTwo()).toBe(0);
  });

  it("notifies every subscriber when no cipher is named", () => {
    const cipherOne = watch("cipher-1");
    const cipherTwo = watch("cipher-2");

    service.notifyAccessChanged();

    expect(cipherOne()).toBe(1);
    expect(cipherTwo()).toBe(1);
  });

  it("fans one notification out to every subscriber of the same cipher", () => {
    const first = watch("cipher-1");
    const second = watch("cipher-1");

    service.notifyAccessChanged("cipher-1");

    expect(first()).toBe(1);
    expect(second()).toBe(1);
  });

  it("does not replay a notification that fired before subscribing", () => {
    service.notifyAccessChanged("cipher-1");

    const cipherOne = watch("cipher-1");

    expect(cipherOne()).toBe(0);
  });

  it("treats a server push as invalidating every cipher", () => {
    const cipherOne = watch("cipher-1");
    const cipherTwo = watch("cipher-2");

    push$.next();

    expect(cipherOne()).toBe(1);
    expect(cipherTwo()).toBe(1);
  });

  it("notifies a subscriber that names no cipher of every mutation and every push", () => {
    let count = 0;
    subscriptions.push(service.accessChanged$().subscribe(() => (count += 1)));

    service.notifyAccessChanged("cipher-1");
    service.notifyAccessChanged("cipher-2");
    service.notifyAccessChanged();
    push$.next();

    expect(count).toBe(4);
  });

  it("does not attach to the push channel until a consumer subscribes", () => {
    expect(push$.observed).toBe(false);

    watch("cipher-1");

    expect(push$.observed).toBe(true);
  });

  it("keeps emitting for later notifications", () => {
    const cipherOne = watch("cipher-1");

    service.notifyAccessChanged("cipher-1");
    service.notifyAccessChanged();
    service.notifyAccessChanged("cipher-1");

    expect(cipherOne()).toBe(3);
  });
});
