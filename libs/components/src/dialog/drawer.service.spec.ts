import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { DrawerRef } from "./dialog-ref";
import { DrawerService } from "./drawer.service";

describe("DrawerService", () => {
  let service: DrawerService;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    logService = mock<LogService>();
    TestBed.configureTestingModule({
      providers: [{ provide: LogService, useValue: logService }],
    });
    service = TestBed.inject(DrawerService);
  });

  /** Create a DrawerRef wired to the service, mirroring how DialogService.stackDrawer does it. */
  function makeRef(
    options: { closePredicate?: (result?: any) => Promise<boolean> } = {},
  ): DrawerRef<any, any> {
    const ref: DrawerRef = new DrawerRef(
      () => service.pop(ref),
      () => service.isTop(ref),
      () => makeRef(),
      false,
      options.closePredicate,
      logService,
    );
    service.push(ref);
    return ref;
  }

  describe("pop", () => {
    // These assertions are what distinguishes `pop(ref)` from a blind "drop the last entry".
    // Without them, reverting the guard leaves the whole suite green — verified — so the
    // protection against a resumed async close tearing down an unrelated drawer can be
    // refactored away silently.
    it("pops the ref when it is on top", () => {
      const root = makeRef();
      const top = makeRef();

      service.pop(top);

      expect(service.stackDepth()).toBe(1);
      expect(service.isTop(root)).toBe(true);
    });

    it("is a no-op when the ref is buried", () => {
      const root = makeRef();
      const top = makeRef();

      service.pop(root);

      expect(service.stackDepth()).toBe(2);
      expect(service.isTop(top)).toBe(true);
    });

    it("is a no-op when the ref is not on the stack at all", () => {
      const top = makeRef();
      const orphan: DrawerRef = new DrawerRef(
        () => service.pop(orphan),
        () => service.isTop(orphan),
        () => makeRef(),
        false,
        undefined,
        logService,
      );

      service.pop(orphan);

      expect(service.stackDepth()).toBe(1);
      expect(service.isTop(top)).toBe(true);
    });

    it("resets push mode once the last ref is popped", () => {
      const only = makeRef();
      service.declarePushWidth(240);
      service.isPushMode.set(true);

      service.pop(only);

      expect(service.stackDepth()).toBe(0);
      expect(service.pushWidthPx()).toBe(0);
      expect(service.isPushMode()).toBe(false);
    });
  });

  describe("closeAll", () => {
    it("returns false and stops when an intermediate ref's predicate rejects", async () => {
      const root = makeRef({ closePredicate: () => Promise.resolve(false) });
      makeRef();
      makeRef();

      const result = await service.closeAll();

      expect(result).toBe(false);
      // top and middle closed, root remains because its predicate rejected.
      expect(service.stackDepth()).toBe(1);
      expect(service.isTop(root)).toBe(true);
    });

    it("returns false and stops when an intermediate ref has disableClose=true", async () => {
      makeRef();
      const middle = makeRef();
      middle.disableClose = true;
      makeRef();

      const result = await service.closeAll();

      expect(result).toBe(false);
      // Only the top was closed; middle (locked) and root remain.
      expect(service.stackDepth()).toBe(2);
      expect(service.isTop(middle)).toBe(true);
    });
  });

  describe("close on a buried ref", () => {
    it("is a no-op and logs an error", async () => {
      const root = makeRef();
      const top = makeRef();

      const result = await root.close();

      expect(result).toEqual({ closed: false });
      expect(service.stackDepth()).toBe(2);
      expect(service.isTop(top)).toBe(true);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("forceCloseAll", () => {
    it("fires closed on every ref in stack order (top-down)", () => {
      const root = makeRef();
      const middle = makeRef();
      const top = makeRef();

      const closedOrder: string[] = [];
      root.closed.subscribe(() => closedOrder.push("root"));
      middle.closed.subscribe(() => closedOrder.push("middle"));
      top.closed.subscribe(() => closedOrder.push("top"));

      service.forceCloseAll();

      expect(closedOrder).toEqual(["top", "middle", "root"]);
      expect(service.stackDepth()).toBe(0);
    });
  });
});
