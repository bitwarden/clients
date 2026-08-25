import { Signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Params, provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { requestDrawerShowing } from "./request-drawer-showing";

describe("requestDrawerShowing", () => {
  let queryParams: BehaviorSubject<Params>;
  let showing: Signal<boolean>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    queryParams = TestBed.inject(ActivatedRoute).queryParams as BehaviorSubject<Params>;
    showing = TestBed.runInInjectionContext(() => requestDrawerShowing());
  });

  it("is false on the bare list, so opening a request pushes an entry to come back to", () => {
    expect(showing()).toBe(false);
  });

  it("is true while a request is named, so the next row opened replaces rather than stacks", () => {
    queryParams.next({ requestId: "req-1" });

    expect(showing()).toBe(true);
  });

  it("goes back to false once the request is cleared", () => {
    queryParams.next({ requestId: "req-1" });
    queryParams.next({});

    expect(showing()).toBe(false);
  });

  it("ignores a requestId that is not a single value, matching the shell's own read of it", () => {
    queryParams.next({ requestId: ["req-1", "req-2"] });

    expect(showing()).toBe(false);
  });
});
