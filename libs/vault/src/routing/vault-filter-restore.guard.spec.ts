import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Navigation,
  Params,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  createUrlTreeFromSnapshot,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { VaultFilterMemoryService } from "./vault-filter-memory.service";
import { vaultFilterRestoreGuard } from "./vault-filter-restore.guard";
import { ALL_ITEMS_SCOPE, VAULT_FILTER_SCOPE, VAULT_SCOPE_PARAM } from "./vault-scope";

jest.mock("@angular/router", () => ({
  ...jest.requireActual("@angular/router"),
  createUrlTreeFromSnapshot: jest.fn(),
}));

const ORG_ID = "8f9a1b2c-3d4e-4f50-a1b2-c3d4e5f60718" as OrganizationId;

describe("vaultFilterRestoreGuard", () => {
  let configService: MockProxy<ConfigService>;
  let router: MockProxy<Router>;
  let paramsFor: jest.Mock;

  const route = mock<ActivatedRouteSnapshot>();
  const mockUrlTree = mock<UrlTree>();

  /**
   * A router state whose activated route opts into the memory. Built as a plain object rather than
   * a mock so `vaultScopeOf` can walk `root.firstChild` and read `data`.
   */
  function makeState(
    queryParams: Params,
    { inScope = true, vaultId }: { inScope?: boolean; vaultId?: string } = {},
  ): RouterStateSnapshot {
    const child: Pick<ActivatedRouteSnapshot, "data" | "paramMap" | "firstChild"> = {
      data: inScope ? { [VAULT_FILTER_SCOPE]: true } : {},
      paramMap: convertToParamMap(vaultId == null ? {} : { [VAULT_SCOPE_PARAM]: vaultId }),
      firstChild: null,
    };
    return { root: { data: {}, queryParams, firstChild: child } } as unknown as RouterStateSnapshot;
  }

  function runGuard(state: RouterStateSnapshot) {
    return TestBed.runInInjectionContext(() => vaultFilterRestoreGuard(route, state));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(true);

    router = mock<Router>();
    router.getCurrentNavigation.mockReturnValue({ trigger: "imperative" } as Navigation);

    paramsFor = jest.fn().mockReturnValue({});
    jest.mocked(createUrlTreeFromSnapshot).mockReturnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: Router, useValue: router },
        { provide: VaultFilterMemoryService, useValue: { paramsFor } },
      ],
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("redirects to the remembered filters when the URL carries none", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1", "vault.folder": "f-1" });

    await expect(runGuard(makeState({}))).resolves.toBe(mockUrlTree);
    expect(createUrlTreeFromSnapshot).toHaveBeenCalledWith(route, [], {
      "vault.type": "1",
      "vault.folder": "f-1",
    });
  });

  it("reads the memory under the scope the route resolves to", async () => {
    await runGuard(makeState({}, { vaultId: ORG_ID }));

    expect(paramsFor).toHaveBeenCalledWith(ORG_ID);
  });

  it("resolves a route with no vault param to the all-items scope", async () => {
    await runGuard(makeState({}));

    expect(paramsFor).toHaveBeenCalledWith(ALL_ITEMS_SCOPE);
  });

  it("carries a deep link's own params through the redirect", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });

    await runGuard(makeState({ cipherId: "c-1", action: "view" }));

    expect(createUrlTreeFromSnapshot).toHaveBeenCalledWith(route, [], {
      cipherId: "c-1",
      action: "view",
      "vault.type": "1",
    });
  });

  it("passes through when the URL already states its filters", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });

    await expect(runGuard(makeState({ "vault.folder": "f-1" }))).resolves.toBe(true);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });

  // `vault.search` isn't remembered, so a link carrying only a search term reads as filter-less to
  // the memory. Layering a remembered type onto it would show something the link didn't ask for.
  it("passes through when the URL carries only a search term", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });

    await expect(runGuard(makeState({ "vault.search": "gmail" }))).resolves.toBe(true);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });

  it("passes through when nothing has been remembered for the scope", async () => {
    await expect(runGuard(makeState({}))).resolves.toBe(true);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });

  it("passes through on back and forward so the history entry is left alone", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });
    router.getCurrentNavigation.mockReturnValue({ trigger: "popstate" } as Navigation);

    await expect(runGuard(makeState({}))).resolves.toBe(true);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });

  it("passes through on a route that hasn't opted into the memory", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });

    await expect(runGuard(makeState({}, { inScope: false }))).resolves.toBe(true);
    expect(paramsFor).not.toHaveBeenCalled();
  });

  it("passes through when VFO1Foundation is off", async () => {
    paramsFor.mockReturnValue({ "vault.type": "1" });
    configService.getFeatureFlag.mockResolvedValue(false);

    await expect(runGuard(makeState({}))).resolves.toBe(true);
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });
});
