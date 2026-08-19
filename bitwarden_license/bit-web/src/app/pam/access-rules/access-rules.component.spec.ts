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

function rule(id: string, name = "Rule", enabled = true): AccessRuleView {
  return {
    id,
    organizationId: "org-1",
    name,
    description: undefined,
    enabled,
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

type ProviderOverride = { provide: unknown; useValue: unknown };

// The component's own template pulls in the full table/toolbar stack; replace it so these
// tests exercise the component logic, not the rendering of child widgets.
const setup = async (
  rules: AccessRuleView[],
  overrides: ProviderOverride[] = [],
): Promise<ComponentFixture<AccessRulesComponent>> => {
  TestBed.overrideComponent(AccessRulesComponent, { set: { template: "" } });

  TestBed.configureTestingModule({
    imports: [AccessRulesComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { params: of({ organizationId: "org-1" }) } },
      {
        provide: AccessRuleSdkService,
        useValue: { listAccessRules: jest.fn().mockResolvedValue(rules) },
      },
      { provide: DialogService, useValue: {} },
      { provide: ToastService, useValue: { showToast: jest.fn() } },
      { provide: I18nService, useValue: i18nFake },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ...overrides,
    ],
  });

  const fixture = TestBed.createComponent(AccessRulesComponent);
  // Cycle change detection + microtasks so the org-driven reload resolves.
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  return fixture;
};

describe("AccessRulesComponent — create/edit navigation", () => {
  let navigate: jest.SpyInstance;
  let route: ActivatedRoute;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupNavigation = async (
    rules: AccessRuleView[],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    const fixture = await setup(rules);
    route = TestBed.inject(ActivatedRoute);
    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    return fixture;
  };

  it("navigates to the create page", async () => {
    const fixture = await setupNavigation([]);

    await fixture.componentInstance["openCreate"]();

    expect(navigate).toHaveBeenCalledWith(["new"], { relativeTo: route });
  });

  it("navigates to the create page with the chosen template", async () => {
    const fixture = await setupNavigation([]);

    await fixture.componentInstance["openFromTemplate"]("approval-required");

    expect(navigate).toHaveBeenCalledWith(["new"], {
      relativeTo: route,
      queryParams: { template: "approval-required" },
    });
  });

  it("navigates to the edit page for a rule", async () => {
    const fixture = await setupNavigation([rule("rule-1", "VPN")]);

    await fixture.componentInstance["openEdit"](rule("rule-1", "VPN"));

    expect(navigate).toHaveBeenCalledWith(["rule-1"], { relativeTo: route });
  });

  it("navigates to the create page seeded from the rule being duplicated", async () => {
    const fixture = await setupNavigation([rule("rule-1", "VPN")]);

    await fixture.componentInstance["duplicate"](rule("rule-1", "VPN"));

    expect(navigate).toHaveBeenCalledWith(["new"], {
      relativeTo: route,
      queryParams: { duplicateFrom: "rule-1" },
    });
  });
});

describe("AccessRulesComponent — activation toasts", () => {
  let showToast: jest.Mock;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupToasts = async (
    rules: AccessRuleView[],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    showToast = jest.fn();
    const updateAccessRule = jest
      .fn()
      .mockImplementation((_orgId, id) => Promise.resolve(rule(id)));

    return await setup(rules, [
      {
        provide: AccessRuleSdkService,
        useValue: { listAccessRules: jest.fn().mockResolvedValue(rules), updateAccessRule },
      },
      { provide: ToastService, useValue: { showToast } },
    ]);
  };

  it("reports a deactivation when toggling an active rule off", async () => {
    const active = rule("rule-1", "VPN", true);
    const fixture = await setupToasts([active]);

    await fixture.componentInstance["toggleEnabled"](active);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleDeactivateSuccess",
    });
  });

  it("reports an activation when toggling an inactive rule on", async () => {
    const inactive = rule("rule-1", "VPN", false);
    const fixture = await setupToasts([inactive]);

    await fixture.componentInstance["toggleEnabled"](inactive);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleActivateSuccess",
    });
  });
});
