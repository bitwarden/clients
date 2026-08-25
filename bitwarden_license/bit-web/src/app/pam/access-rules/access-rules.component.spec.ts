import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { accessRuleDeactivateConfirmOptions, AccessRuleSdkService, AccessRuleView } from "..";

import { AccessRulesComponent } from "./access-rules.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

/** The SDK's flat access-rule error: a `name`-tagged Error carrying a `variant`. */
const accessRuleError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "AccessRuleError", variant });

// A real rejected mutation: the whole wire response, stack trace and server filesystem paths
// included, on the error's `message`. None of it may reach a toast.
const RAW_SERVER_PAYLOAD =
  'error in response: status code 400 Bad Request: {"object":"error","message":"One or more ' +
  'collections are already governed by another access rule.","validationErrors":null,' +
  '"exceptionStackTrace":" at Bit.Services.Pam.Services.AccessRuleWriteValidator' +
  ".ValidateCollectionsAsync(Guid organizationId) in /Users/build/server/bitwarden_license/src/" +
  'Services/Pam/Services/AccessRuleWriteValidator.cs:line 87"}';

/** The same envelope for the name-uniqueness rejection, which the copy flow retries against. */
const NAME_TAKEN_PAYLOAD =
  'error in response: status code 400 Bad Request: {"object":"error","message":"A rule with ' +
  'that name already exists.","validationErrors":null}';

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

type SetupOptions = {
  overrides?: ProviderOverride[];
  /** Resolves to the user's answer for every confirmation the test triggers. */
  openSimpleDialog?: jest.Mock;
};

// The component's own template pulls in the full table/toolbar stack; replace it so these
// tests exercise the component logic, not the rendering of child widgets.
const setup = async (
  rules: AccessRuleView[],
  { overrides = [], openSimpleDialog = jest.fn().mockResolvedValue(true) }: SetupOptions = {},
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
      { provide: ToastService, useValue: { showToast: jest.fn() } },
      { provide: I18nService, useValue: i18nFake },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ...overrides,
    ],
  });

  // Overridden rather than provided: the component's imported modules bring their own
  // `DialogService` into the standalone injector, which shadows a TestBed provider.
  TestBed.overrideProvider(DialogService, { useValue: { openSimpleDialog } });

  const fixture = TestBed.createComponent(AccessRulesComponent);
  // Cycle change detection + microtasks so the org-driven reload resolves.
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  return fixture;
};

/** The mocks every mutation test asserts against, rebuilt per fixture. */
let showToast: jest.Mock;
let openSimpleDialog: jest.Mock;
let updateAccessRule: jest.Mock;
let deleteAccessRule: jest.Mock;
let createAccessRule: jest.Mock;

/**
 * A fixture wired for mutations: SDK writes and toasts spy-able, and every confirmation
 * answered with `confirmed`. The write mocks resolve by default; a test that needs a failure
 * re-points them with `mockRejectedValue`.
 */
const setupMutations = async (
  rules: AccessRuleView[],
  confirmed = true,
  overrides: ProviderOverride[] = [],
): Promise<ComponentFixture<AccessRulesComponent>> => {
  showToast = jest.fn();
  openSimpleDialog = jest.fn().mockResolvedValue(confirmed);
  updateAccessRule = jest.fn().mockImplementation((_orgId, id) => Promise.resolve(rule(id)));
  deleteAccessRule = jest.fn().mockResolvedValue(undefined);
  // Echoes back the name it was asked for, so a test can assert on the created rule without
  // restating it.
  createAccessRule = jest
    .fn()
    .mockImplementation((_orgId, request) => Promise.resolve(rule("rule-copy", request.name)));

  return await setup(rules, {
    overrides: [
      {
        provide: AccessRuleSdkService,
        useValue: {
          listAccessRules: jest.fn().mockResolvedValue(rules),
          createAccessRule,
          updateAccessRule,
          deleteAccessRule,
        },
      },
      { provide: ToastService, useValue: { showToast } },
      ...overrides,
    ],
    openSimpleDialog,
  });
};

/** {@link setupMutations} with the whole list selected, for the bulk-actions bar. */
const setupBulk = async (
  rules: AccessRuleView[],
  confirmed = true,
): Promise<ComponentFixture<AccessRulesComponent>> => {
  const fixture = await setupMutations(rules, confirmed);
  fixture.componentInstance["selection"].select(...rules.map((r) => r.id));
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
});

describe("AccessRulesComponent — make a copy", () => {
  let navigate: jest.SpyInstance;
  let route: ActivatedRoute;

  /**
   * Renders the two copy-name templates rather than echoing their keys, so the name the
   * component asks `copyRuleName` for is legible in the assertions.
   */
  const COPY_NAME_TEMPLATES: Record<string, (name: string, count?: number) => string> = {
    pamAccessRuleDuplicateName: (name) => `${name} (copy)`,
    pamAccessRuleDuplicateNameNumbered: (name, count) => `${name} (copy ${count})`,
  };
  const i18nRendering: Pick<I18nService, "t" | "translate"> = {
    t: (id: string, p1?: string | number, p2?: string | number) =>
      COPY_NAME_TEMPLATES[id]?.(String(p1), Number(p2)) ?? id,
    translate: (id: string) => id,
  };

  const SOURCE = rule("rule-1", "VPN");

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupCopy = async (
    rules: AccessRuleView[] = [SOURCE],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    const fixture = await setupMutations(rules, true, [
      { provide: I18nService, useValue: i18nRendering },
    ]);
    route = TestBed.inject(ActivatedRoute);
    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    return fixture;
  };

  it("creates the copy straight away, with no confirmation", async () => {
    const fixture = await setupCopy();

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(openSimpleDialog).not.toHaveBeenCalled();
    expect(createAccessRule).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "VPN (copy)" }),
    );
  });

  it("gives the copy no collections and the source's enabled state", async () => {
    const governed = {
      ...rule("rule-1", "VPN", false),
      collections: ["collection-1"],
    } as unknown as AccessRuleView;
    const fixture = await setupCopy([governed]);

    await fixture.componentInstance["makeCopy"](governed);

    expect(createAccessRule).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ collections: [], enabled: false }),
    );
  });

  it("numbers the name past the copies already in the table", async () => {
    const fixture = await setupCopy([SOURCE, rule("rule-2", "VPN (copy)")]);

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(createAccessRule).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "VPN (copy 2)" }),
    );
  });

  it("opens the created copy for renaming", async () => {
    const fixture = await setupCopy();

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(navigate).toHaveBeenCalledWith(["rule-copy"], {
      relativeTo: route,
      queryParams: { renaming: true },
    });
  });

  it("reports the copy, since backing out of the form will not undo it", async () => {
    const fixture = await setupCopy();

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleCopyCreated",
    });
  });

  it("refreshes the list and retries once when the chosen name was already taken", async () => {
    const fixture = await setupCopy();
    // Swapped in after the initial load, so the retry's refresh is the first read that sees the
    // copy another admin made in the meantime.
    fixture.componentInstance["accessRules"]["pamApi"].listAccessRules = jest
      .fn()
      .mockResolvedValue([SOURCE, rule("rule-9", "VPN (copy)")]);
    createAccessRule.mockRejectedValueOnce(accessRuleError("Api", NAME_TAKEN_PAYLOAD));

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(createAccessRule).toHaveBeenNthCalledWith(
      1,
      "org-1",
      expect.objectContaining({ name: "VPN (copy)" }),
    );
    expect(createAccessRule).toHaveBeenNthCalledWith(
      2,
      "org-1",
      expect.objectContaining({ name: "VPN (copy 2)" }),
    );
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });

  it("does not announce the copy when a failed navigation follows the create", async () => {
    const fixture = await setupCopy();
    navigate.mockRejectedValue(new Error("guard blew up"));

    await expect(fixture.componentInstance["makeCopy"](SOURCE)).rejects.toThrow("guard blew up");

    // The rule exists, so the one thing that must not happen is an error toast claiming otherwise.
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });

  it("stays on the table and toasts the mapped failure when the create is rejected", async () => {
    const fixture = await setupCopy();
    createAccessRule.mockRejectedValue(accessRuleError("Api", RAW_SERVER_PAYLOAD));

    await fixture.componentInstance["makeCopy"](SOURCE);

    expect(navigate).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      variant: "error",
      message: "pamAccessRuleErrorCollectionsGoverned",
    });
  });
});

describe("AccessRulesComponent — mutation success toasts", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports a deactivation when toggling an active rule off", async () => {
    const active = rule("rule-1", "VPN", true);
    const fixture = await setupMutations([active]);

    await fixture.componentInstance["toggleEnabled"](active);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleDeactivateSuccess",
    });
  });

  it("reports an activation when toggling an inactive rule on", async () => {
    const inactive = rule("rule-1", "VPN", false);
    const fixture = await setupMutations([inactive]);

    await fixture.componentInstance["toggleEnabled"](inactive);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleActivateSuccess",
    });
  });

  it("confirms before deactivating", async () => {
    const active = rule("rule-1", "VPN", true);
    const fixture = await setupMutations([active]);

    await fixture.componentInstance["toggleEnabled"](active);

    expect(openSimpleDialog).toHaveBeenCalledWith(accessRuleDeactivateConfirmOptions());
  });

  it("leaves the rule active and silent when the deactivate confirm is dismissed", async () => {
    const active = rule("rule-1", "VPN", true);
    const fixture = await setupMutations([active], false);

    await fixture.componentInstance["toggleEnabled"](active);

    expect(updateAccessRule).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not confirm before activating", async () => {
    const inactive = rule("rule-1", "VPN", false);
    const fixture = await setupMutations([inactive]);

    await fixture.componentInstance["toggleEnabled"](inactive);

    expect(openSimpleDialog).not.toHaveBeenCalled();
    expect(updateAccessRule).toHaveBeenCalled();
  });

  it("reports a success toast after deleting a single rule", async () => {
    const target = rule("rule-1", "VPN");
    const fixture = await setupMutations([target]);

    await fixture.componentInstance["remove"](target);

    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      message: "pamAccessRuleDeleted",
    });
  });
});

describe("AccessRulesComponent — failed mutations", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the server's serialized response out of a failed delete's toast", async () => {
    const target = rule("rule-1", "VPN");
    const fixture = await setupMutations([target]);
    deleteAccessRule.mockRejectedValue(accessRuleError("Api", RAW_SERVER_PAYLOAD));

    await fixture.componentInstance["remove"](target);

    const message = showToast.mock.calls.at(-1)![0].message as string;
    expect(message).toBe("pamAccessRuleErrorCollectionsGoverned");
    expect(message).not.toContain("exceptionStackTrace");
    expect(message).not.toContain("status code 400");
  });

  it("toasts generic copy for a delete rejected with an unrecognised message", async () => {
    const target = rule("rule-1", "VPN");
    const fixture = await setupMutations([target]);
    deleteAccessRule.mockRejectedValue(
      accessRuleError("Api", "error in response: status code 500: something the UI cannot map"),
    );

    await fixture.componentInstance["remove"](target);

    expect(showToast).toHaveBeenCalledWith({ variant: "error", message: "unexpectedError" });
  });

  it("toasts the rule-is-gone copy when a toggle finds the rule deleted", async () => {
    const target = rule("rule-1", "VPN", true);
    const fixture = await setupMutations([target]);
    updateAccessRule.mockRejectedValue(accessRuleError("NotFound", ""));

    await fixture.componentInstance["toggleEnabled"](target);

    expect(showToast).toHaveBeenCalledWith({
      variant: "error",
      message: "pamAccessRuleErrorMissing",
    });
  });
});

describe("AccessRulesComponent — bulk deactivate confirmation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("counts only the selected rules the action will actually change", async () => {
    const rules = [
      rule("rule-1", "VPN", true),
      rule("rule-2", "SSH", true),
      rule("rule-3", "DB", false),
    ];
    const fixture = await setupBulk(rules);

    await fixture.componentInstance["bulkSetEnabled"](false);

    expect(openSimpleDialog).toHaveBeenCalledWith(accessRuleDeactivateConfirmOptions(2));
  });

  // "1 rules will stop applying" is not a sentence, and the single-rule dialog is the copy
  // design signed off for deactivating one rule — wherever it is triggered from.
  it("asks the single-rule question when only one selected rule will change", async () => {
    const rules = [rule("rule-1", "VPN", true), rule("rule-2", "SSH", false)];
    const fixture = await setupBulk(rules);

    await fixture.componentInstance["bulkSetEnabled"](false);

    expect(openSimpleDialog).toHaveBeenCalledWith(accessRuleDeactivateConfirmOptions());
  });

  it("leaves the rules alone when the bulk confirm is dismissed", async () => {
    const fixture = await setupBulk(
      [rule("rule-1", "VPN", true), rule("rule-2", "SSH", true)],
      false,
    );

    await fixture.componentInstance["bulkSetEnabled"](false);

    expect(updateAccessRule).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("skips the question when every selected rule is already inactive", async () => {
    const fixture = await setupBulk([rule("rule-1", "VPN", false)]);

    await fixture.componentInstance["bulkSetEnabled"](false);

    expect(openSimpleDialog).not.toHaveBeenCalled();
    expect(updateAccessRule).not.toHaveBeenCalled();
  });

  // An inactive rule would short-circuit on the count guard and pass even with the activation
  // branch deleted, so this starts from an active one that the guard would otherwise catch.
  it("does not confirm before bulk activating", async () => {
    const fixture = await setupBulk([rule("rule-1", "VPN", true), rule("rule-2", "SSH", false)]);

    await fixture.componentInstance["bulkSetEnabled"](true);

    expect(openSimpleDialog).not.toHaveBeenCalled();
    expect(updateAccessRule).toHaveBeenCalled();
  });
});
