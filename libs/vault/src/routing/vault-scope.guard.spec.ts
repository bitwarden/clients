import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { ARCHIVE_ROUTE, MY_VAULT_ROUTE, TRASH_ROUTE } from "../models/vault-scope";

import { vaultScopeGuard } from "./vault-scope.guard";

describe("vaultScopeGuard", () => {
  const userId = "user-1" as UserId;
  const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
  const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

  const state = mock<RouterStateSnapshot>();
  const allItemsUrlTree = mock<UrlTree>();

  let router: MockProxy<Router>;
  let organizationService: MockProxy<OrganizationService>;

  const makeRoute = (vaultId?: string): ActivatedRouteSnapshot =>
    mock<ActivatedRouteSnapshot>({
      paramMap: convertToParamMap(vaultId == null ? {} : { vaultId }),
    });

  const runGuard = (vaultId?: string) =>
    TestBed.runInInjectionContext(() => vaultScopeGuard(makeRoute(vaultId), state));

  beforeEach(() => {
    router = mock<Router>();
    router.createUrlTree.mockReturnValue(allItemsUrlTree);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ id: organizationId } as Organization]),
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
      ],
    });
  });

  it("allows the personal vault", async () => {
    await expect(runGuard(MY_VAULT_ROUTE)).resolves.toBe(true);
  });

  it("allows trash and the archive, which need no membership check", async () => {
    await expect(runGuard(TRASH_ROUTE)).resolves.toBe(true);
    await expect(runGuard(ARCHIVE_ROUTE)).resolves.toBe(true);
    expect(organizationService.organizations$).not.toHaveBeenCalled();
  });

  it("allows an organization the user is a member of", async () => {
    await expect(runGuard(organizationId)).resolves.toBe(true);
  });

  it("redirects to All items for an organization the user is not a member of", async () => {
    await expect(runGuard(otherOrganizationId)).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  it("redirects to All items for a segment that names no destination", async () => {
    await expect(runGuard("acme-corp")).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  it("does not resolve organizations for a segment it can reject outright", async () => {
    await runGuard("acme-corp");

    expect(organizationService.organizations$).not.toHaveBeenCalled();
  });
});
