import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AccessRuleSdkService, AccessRuleView } from "..";

import { AccessRulesComponent } from "./access-rules.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function rule(id: string, name = "Rule"): AccessRuleView {
  return {
    id,
    organizationId: "org-1",
    name,
    description: undefined,
    enabled: true,
    conditions: [],
    singleActiveLease: false,
    defaultLeaseDurationSeconds: undefined,
    maxLeaseDurationSeconds: undefined,
    allowsExtensions: false,
    maxExtensionDurationSeconds: undefined,
    collections: [],
    creationDate: "2024-01-01T00:00:00.000Z",
    revisionDate: "2024-01-01T00:00:00.000Z",
  } as unknown as AccessRuleView;
}

describe("AccessRulesComponent — create/edit navigation", () => {
  let listAccessRules: jest.Mock;
  let navigate: jest.SpyInstance;
  let route: ActivatedRoute;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = async (
    rules: AccessRuleView[],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    listAccessRules = jest.fn().mockResolvedValue(rules);

    // The component's own template pulls in the full table/toolbar stack; replace it
    // so these tests exercise the navigation logic, not the rendering of child widgets.
    TestBed.overrideComponent(AccessRulesComponent, { set: { template: "" } });

    TestBed.configureTestingModule({
      imports: [AccessRulesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }) },
        },
        { provide: AccessRuleSdkService, useValue: { listAccessRules } },
        { provide: DialogService, useValue: {} },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ],
    });

    route = TestBed.inject(ActivatedRoute);
    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    const fixture = TestBed.createComponent(AccessRulesComponent);
    // Cycle change detection + microtasks so the org-driven reload resolves.
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture;
  };

  it("navigates to the create page", async () => {
    const fixture = await setup([]);

    await fixture.componentInstance["openCreate"]();

    expect(navigate).toHaveBeenCalledWith(["new"], { relativeTo: route });
  });

  it("navigates to the create page with the chosen template", async () => {
    const fixture = await setup([]);

    await fixture.componentInstance["openFromTemplate"]("approval-required");

    expect(navigate).toHaveBeenCalledWith(["new"], {
      relativeTo: route,
      queryParams: { template: "approval-required" },
    });
  });

  it("navigates to the edit page for a rule", async () => {
    const fixture = await setup([rule("rule-1", "VPN")]);

    await fixture.componentInstance["openEdit"](rule("rule-1", "VPN"));

    expect(navigate).toHaveBeenCalledWith(["rule-1"], { relativeTo: route });
  });
});
