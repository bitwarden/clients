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

/** The SDK's flat access-rule error: a `name`-tagged Error carrying a `variant`. */
const accessRuleError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "AccessRuleError", variant });

// What a transport failure still carries on its `message`: the whole wire response, stack trace and
// server filesystem paths included. Never read, and so never at risk of reaching a toast.
const RAW_SERVER_PAYLOAD =
  'error in response: status code 400 Bad Request: {"object":"error","message":"One or more ' +
  'collections are already governed by another access rule.","validationErrors":null,' +
  '"exceptionStackTrace":" at Bit.Services.Pam.Services.AccessRuleWriteValidator' +
  ".ValidateCollectionsAsync(Guid organizationId) in /Users/build/server/bitwarden_license/src/" +
  'Services/Pam/Services/AccessRuleWriteValidator.cs:line 87"}';

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

describe("AccessRulesComponent — failed mutations", () => {
  let showToast: jest.Mock;
  let deleteAccessRule: jest.Mock;
  let updateAccessRule: jest.Mock;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = async (
    rules: AccessRuleView[],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    showToast = jest.fn();
    deleteAccessRule = jest.fn();
    updateAccessRule = jest.fn();

    TestBed.overrideComponent(AccessRulesComponent, { set: { template: "" } });

    TestBed.configureTestingModule({
      imports: [AccessRulesComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ organizationId: "org-1" }) } },
        {
          provide: AccessRuleSdkService,
          useValue: {
            listAccessRules: jest.fn().mockResolvedValue(rules),
            deleteAccessRule,
            updateAccessRule,
          },
        },
        { provide: ToastService, useValue: { showToast } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ],
    });

    // Overridden rather than provided: the component's imported modules bring their own
    // `DialogService` into the standalone injector, which shadows a TestBed provider.
    TestBed.overrideProvider(DialogService, {
      useValue: { openSimpleDialog: jest.fn().mockResolvedValue(true) },
    });

    const fixture = TestBed.createComponent(AccessRulesComponent);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture;
  };

  it("toasts our copy for a mapped delete failure, never the server's payload", async () => {
    const target = rule("rule-1", "VPN");
    const fixture = await setup([target]);
    // The variant is what the toast is chosen from; the payload rides along and is ignored.
    deleteAccessRule.mockRejectedValue(
      accessRuleError("CollectionsAlreadyGoverned", RAW_SERVER_PAYLOAD),
    );

    await fixture.componentInstance["remove"](target);

    const message = showToast.mock.calls.at(-1)![0].message as string;
    expect(message).toBe("pamAccessRuleErrorCollectionsGoverned");
    expect(message).not.toContain("exceptionStackTrace");
    expect(message).not.toContain("status code 400");
  });

  it("toasts generic copy for a delete rejected with an unmapped variant", async () => {
    const target = rule("rule-1", "VPN");
    const fixture = await setup([target]);
    deleteAccessRule.mockRejectedValue(
      accessRuleError("Api", "error in response: status code 500: something the UI cannot map"),
    );

    await fixture.componentInstance["remove"](target);

    expect(showToast).toHaveBeenCalledWith({ variant: "error", message: "unexpectedError" });
  });

  it("toasts the rule-is-gone copy when a toggle finds the rule deleted", async () => {
    const target = rule("rule-1", "VPN", true);
    const fixture = await setup([target]);
    updateAccessRule.mockRejectedValue(accessRuleError("NotFound", ""));

    await fixture.componentInstance["toggleEnabled"](target);

    expect(showToast).toHaveBeenCalledWith({
      variant: "error",
      message: "pamAccessRuleErrorMissing",
    });
  });
});
