import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, convertToParamMap, Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import {
  canActivateImportType,
  importSourceFromQuery,
  importTypeFromRoute,
} from "./import-type-route";

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
    // keepasskdbx is grouped under keepass's card rather than having one of its own — see
    // PICKER_VENDOR_DATA.
    const result = activate("keepasskdbx");

    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect-here"]);
    expect(result).toBe(redirectTree);
  });

  it("redirects for a format id that used to double as its vendor's picker id", () => {
    void activate("keepass2xml");
    void activate("bitwardenjson");

    expect(router.createUrlTree).toHaveBeenCalledTimes(2);
  });

  it("allows the vendor ids", () => {
    expect(activate("keepass")).toBe(true);
    expect(activate("1password")).toBe(true);
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

describe("importSourceFromQuery", () => {
  const fromQuery = (query: Record<string, string>) =>
    importSourceFromQuery({ snapshot: { queryParamMap: convertToParamMap(query) } } as any);

  it("returns a real picker vendor", () => {
    expect(fromQuery({ source: "keeper" })).toBe("keeper");
  });

  it("drops a real ImportType with no picker card of its own", () => {
    expect(fromQuery({ source: "keepasskdbx" })).toBeUndefined();
  });

  it("drops an unrecognized id", () => {
    expect(fromQuery({ source: "not-a-real-vendor" })).toBeUndefined();
  });

  it("drops Object.prototype property names", () => {
    expect(fromQuery({ source: "constructor" })).toBeUndefined();
    expect(fromQuery({ source: "toString" })).toBeUndefined();
  });

  it("returns undefined when there's no param", () => {
    expect(fromQuery({})).toBeUndefined();
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
