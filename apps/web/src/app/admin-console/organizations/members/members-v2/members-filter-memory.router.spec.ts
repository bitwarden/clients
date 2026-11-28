import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { MEMBERS_FILTER_MEMORY, MembersFilterMemoryService } from "./members-filter-memory.service";
import { membersFilterRestoreGuard, membersFilterRunGuards } from "./members-filter-restore.guard";
import { MEMBERS_FILTER_SCOPE, MembersFilterScopeRouteData } from "./members-filter-scope";

@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class BlankComponent {}

const ORG_A = "0b6e1c4a-1f2d-4c3b-9a8e-7d6c5b4a3f21" as OrganizationId;
const ORG_B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" as OrganizationId;

describe("Members filter memory (router integration)", () => {
  const userId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let router: Router;
  let service: MembersFilterMemoryService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    TestBed.configureTestingModule({
      providers: [
        { provide: StateProvider, useValue: stateProvider },
        { provide: AccountService, useValue: accountService },
        provideRouter([
          {
            path: "organizations/:organizationId",
            children: [
              {
                path: "members",
                component: BlankComponent,
                canActivate: [membersFilterRestoreGuard],
                runGuardsAndResolvers: membersFilterRunGuards,
                data: { [MEMBERS_FILTER_SCOPE]: true } satisfies MembersFilterScopeRouteData,
              },
              { path: "settings", component: BlankComponent },
            ],
          },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    service = TestBed.inject(MembersFilterMemoryService);
  });

  const membersUrl = (org: OrganizationId, query = "") =>
    `/organizations/${org}/members${query ? `?${query}` : ""}`;

  /** Leaves and comes back through a bare link, the way the side nav does. */
  async function leaveAndReturn(org: OrganizationId = ORG_A) {
    await router.navigateByUrl(`/organizations/${org}/settings`);
    await router.navigateByUrl(membersUrl(org));
  }

  it("restores filters, search, sort, and page size when returning through a bare link", async () => {
    await router.navigateByUrl(
      membersUrl(
        ORG_A,
        "members.status=confirmed&members.role=1&members.role=2&members.search=jane" +
          "&members.sort=name&members.direction=desc&members.pageSize=25",
      ),
    );

    await leaveAndReturn();

    const params = router.parseUrl(router.url).queryParamMap;
    expect(params.get("members.status")).toBe("confirmed");
    expect(params.getAll("members.role")).toEqual(["1", "2"]);
    expect(params.get("members.search")).toBe("jane");
    expect(params.get("members.sort")).toBe("name");
    expect(params.get("members.direction")).toBe("desc");
    expect(params.get("members.pageSize")).toBe("25");
  });

  it("starts back on the first page", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1&members.page=3"));

    await leaveAndReturn();

    expect(router.url).toBe(membersUrl(ORG_A, "members.role=1"));
  });

  it("does not persist params outside the members namespace or the allowlist", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1&members.unknown=x&other=y"));

    await expect(service.paramsFor(ORG_A)).resolves.toEqual({ "members.role": "1" });
  });

  it("restores nothing once the filters have been cleared", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));
    // Clear all, written the way the table's `queryParamStore` writes it.
    await router.navigateByUrl(membersUrl(ORG_A), { replaceUrl: true });

    await leaveAndReturn();

    expect(router.url).toBe(membersUrl(ORG_A));
  });

  it("keeps each organization's filters separate", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));
    await router.navigateByUrl(membersUrl(ORG_B, "members.role=4"));

    await leaveAndReturn(ORG_A);
    expect(router.url).toBe(membersUrl(ORG_A, "members.role=1"));

    await leaveAndReturn(ORG_B);
    expect(router.url).toBe(membersUrl(ORG_B, "members.role=4"));
  });

  it("lets a URL with its own members params win over the memory", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));
    await router.navigateByUrl(`/organizations/${ORG_A}/settings`);

    await router.navigateByUrl(membersUrl(ORG_A, "members.status=invited"));

    expect(router.url).toBe(membersUrl(ORG_A, "members.status=invited"));
  });

  it("does not layer remembered filters over an Event Logs deep link", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));
    await router.navigateByUrl(`/organizations/${ORG_A}/settings`);

    await router.navigateByUrl(membersUrl(ORG_A, "search=jane&viewEvents=ou-1"));

    expect(router.url).toBe(membersUrl(ORG_A, "search=jane&viewEvents=ou-1"));
  });

  it("restores what a previous session stored, as after a reload and unlock", async () => {
    stateProvider.singleUser
      .getFake(userId, MEMBERS_FILTER_MEMORY)
      .nextState({ [ORG_A]: { "members.role": "2" } });

    await router.navigateByUrl(membersUrl(ORG_A));

    expect(router.url).toBe(membersUrl(ORG_A, "members.role=2"));
  });

  it("ignores navigation away from the members page", async () => {
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));
    await router.navigateByUrl(`/organizations/${ORG_A}/settings?members.role=4`);

    await expect(service.paramsFor(ORG_A)).resolves.toEqual({ "members.role": "1" });
  });

  describe("navigating to a bare URL while already on the page", () => {
    it("keeps the filters when the side nav link is clicked", async () => {
      await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));

      await router.navigateByUrl(membersUrl(ORG_A));

      expect(router.url).toBe(membersUrl(ORG_A, "members.role=1"));
      await expect(service.paramsFor(ORG_A)).resolves.toEqual({ "members.role": "1" });
    });

    it("lets the table clear its own filters", async () => {
      await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));

      // How the table's `queryParamStore` writes, e.g. on Clear all.
      await router.navigate([], {
        queryParams: { "members.role": null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });

      expect(router.url).toBe(membersUrl(ORG_A));
      await expect(service.paramsFor(ORG_A)).resolves.toEqual({});
    });
  });

  it("keeps each account's filters separate", async () => {
    const otherUserId = Utils.newGuid() as UserId;
    await router.navigateByUrl(membersUrl(ORG_A, "members.role=1"));

    await accountService.switchAccount(otherUserId);

    await expect(service.paramsFor(ORG_A)).resolves.toEqual({});
  });
});
