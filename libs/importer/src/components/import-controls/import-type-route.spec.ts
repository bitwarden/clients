import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, convertToParamMap, Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { canActivateImportType, importTypeFromRoute } from "./import-type-route";

describe("canActivateImportType", () => {
  let router: MockProxy<Router>;
  let redirectTree: UrlTree;

  beforeEach(() => {
    redirectTree = mock<UrlTree>();
    router = mock<Router>();
    router.createUrlTree.mockReturnValue(redirectTree);

    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
  });

  const activate = (importType: string | null) =>
    TestBed.runInInjectionContext(() =>
      canActivateImportType("/redirect-here")(
        {
          paramMap: convertToParamMap(importType ? { importType } : {}),
        } as ActivatedRouteSnapshot,
        {} as any,
      ),
    );

  it("allows activation for a real picker vendor", () => {
    expect(activate("keeper")).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it("redirects for a real ImportType with no picker card of its own", () => {
    // keepasskdbx is grouped under keepass2xml's card rather than having one of its own — see
    // PICKER_VENDOR_DATA.
    const result = activate("keepasskdbx");

    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect-here"]);
    expect(result).toBe(redirectTree);
  });

  it("redirects for an unrecognized id", () => {
    void activate("not-a-real-vendor");

    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect-here"]);
  });

  it("redirects for an Object.prototype property name, not just a missing key", () => {
    void activate("constructor");
    void activate("toString");
    void activate("hasOwnProperty");

    expect(router.createUrlTree).toHaveBeenCalledTimes(3);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect-here"]);
  });

  it("redirects when there's no param at all", () => {
    void activate(null);

    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect-here"]);
  });
});

describe("importTypeFromRoute", () => {
  const buildRoute = (initial: string) => {
    const paramMap$ = new BehaviorSubject(convertToParamMap({ importType: initial }));
    return {
      route: { paramMap: paramMap$, snapshot: { paramMap: paramMap$.value } } as any,
      paramMap$,
    };
  };

  it("resolves synchronously from the initial route snapshot", () => {
    const { route } = buildRoute("keeper");

    const importType = TestBed.runInInjectionContext(() => importTypeFromRoute(route));

    expect(importType()).toBe("keeper");
  });

  it("updates when the route's paramMap emits a new value", () => {
    const { route, paramMap$ } = buildRoute("keeper");
    const importType = TestBed.runInInjectionContext(() => importTypeFromRoute(route));

    paramMap$.next(convertToParamMap({ importType: "lastpasscsv" }));

    expect(importType()).toBe("lastpasscsv");
  });
});
