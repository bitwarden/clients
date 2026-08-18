import { EnvironmentProviders, Provider } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, SelectItemView, ToastService } from "@bitwarden/components";

import { AccessRuleSdkService, AccessRuleView } from "../..";

import { AccessRuleEditComponent } from "./access-rule-edit.component";
import { CidrValidationService } from "./ip-allowlist/cidr-validation.service";

/** Echoes the key as its translation so the form-field components don't crash on missing keys. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

// Stand-in for the SDK-backed CIDR check; these specs don't assert CIDR-format validity, so
// treating every non-empty row as valid keeps seeded IP-allowlist forms submittable.
const cidrValidationStub: CidrValidationService = { isValid: () => true };

const declinedDialogStub = { openSimpleDialog: () => Promise.resolve(false) };

const organizationServiceStub = (canAccessEventLogs = true) => ({
  organizations$: () => of([{ id: "org-1", canAccessEventLogs }]),
});

// Preset durations offered by the pickers, in seconds.
const THIRTY_MIN = 30 * 60;
const ONE_HOUR = 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const NO_CAP = 0;

type RouteState = { params?: Record<string, string>; queryParams?: Record<string, string> };

function routeStub(state: RouteState): Partial<ActivatedRoute> {
  return {
    snapshot: {
      params: { organizationId: "org-1", ...state.params },
      queryParams: state.queryParams ?? {},
    },
  } as unknown as ActivatedRoute;
}

/**
 * The providers every block needs, with `overrides` appended so a block's own stub
 * wins (Angular resolves the last provider for a token).
 */
const providersWith = (...overrides: Provider[]): (Provider | EnvironmentProviders)[] => [
  provideRouter([]),
  { provide: ActivatedRoute, useValue: routeStub({}) },
  { provide: AccessRuleSdkService, useValue: {} },
  { provide: ToastService, useValue: { showToast: jest.fn() } },
  { provide: I18nService, useValue: i18nFake },
  { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
  { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
  { provide: CidrValidationService, useValue: cidrValidationStub },
  { provide: OrganizationService, useValue: organizationServiceStub() },
  { provide: DialogService, useValue: declinedDialogStub },
  ...overrides,
];

describe("AccessRuleEditComponent — default/max duration coupling", () => {
  let fixture: ComponentFixture<AccessRuleEditComponent>;
  let component: AccessRuleEditComponent;

  const setup = () => {
    // These tests exercise the form/coupling logic, not the header/section rendering.
    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: providersWith(),
    });

    fixture = TestBed.createComponent(AccessRuleEditComponent);
    component = fixture.componentInstance;
    // The coupling is wired synchronously in the constructor; no need to await init.
  };

  beforeEach(() => setup());

  const controls = () => component["formGroup"].controls;

  it("starts with the default below an unset max", () => {
    expect(controls().defaultLeaseDurationSeconds.value).toBe(ONE_HOUR);
    expect(controls().maxLeaseDurationSeconds.value).toBe(NO_CAP);
  });

  it("drags the default down when the max is lowered below it", () => {
    controls().maxLeaseDurationSeconds.setValue(THIRTY_MIN);

    expect(controls().defaultLeaseDurationSeconds.value).toBe(THIRTY_MIN);
    expect(controls().maxLeaseDurationSeconds.value).toBe(THIRTY_MIN);
  });

  it("drags the max up when the default is raised above it", () => {
    controls().maxLeaseDurationSeconds.setValue(THIRTY_MIN); // also pulls the default down to 30m
    controls().defaultLeaseDurationSeconds.setValue(ONE_HOUR);

    expect(controls().maxLeaseDurationSeconds.value).toBe(ONE_HOUR);
    expect(controls().defaultLeaseDurationSeconds.value).toBe(ONE_HOUR);
  });

  it("never constrains the default while the max is 'no maximum'", () => {
    controls().defaultLeaseDurationSeconds.setValue(SEVEN_DAYS);

    expect(controls().maxLeaseDurationSeconds.value).toBe(NO_CAP);
    expect(controls().defaultLeaseDurationSeconds.value).toBe(SEVEN_DAYS);
  });

  it("leaves both untouched when default equals max", () => {
    controls().maxLeaseDurationSeconds.setValue(ONE_HOUR);
    controls().defaultLeaseDurationSeconds.setValue(ONE_HOUR);

    expect(controls().maxLeaseDurationSeconds.value).toBe(ONE_HOUR);
    expect(controls().defaultLeaseDurationSeconds.value).toBe(ONE_HOUR);
  });
});

describe("AccessRuleEditComponent — page furniture", () => {
  const render = async (
    state: RouteState,
    existing?: AccessRuleView,
    canAccessEventLogs = true,
  ) => {
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: providersWith(
        { provide: ActivatedRoute, useValue: routeStub(state) },
        {
          provide: AccessRuleSdkService,
          useValue: { getAccessRule: jest.fn().mockResolvedValue(existing) },
        },
        { provide: OrganizationService, useValue: organizationServiceStub(canAccessEventLogs) },
      ),
    });

    jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccessRuleEditComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it("shows the rule's name as the heading, with the list and edit-page crumbs", async () => {
    const fixture = await render({ params: { accessRuleId: "rule-1" } }, {
      id: "rule-1",
      name: "Production database access",
      collections: [],
      conditions: [],
    } as unknown as AccessRuleView);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Production database access");
    expect(text).toContain("pamAccessRules");

    const crumbs = fixture.nativeElement.querySelectorAll("bit-breadcrumbs button");
    expect(crumbs).toHaveLength(0);

    const pageTypeCrumb = fixture.nativeElement.querySelector(
      '[slot="breadcrumbs"] [aria-current="page"]',
    );
    expect(pageTypeCrumb.textContent.trim()).toBe("pamAccessRuleEditTitle");
  });

  it("shows the create-page crumb and heading in create mode", async () => {
    const fixture = await render({});

    const crumbs = fixture.nativeElement.querySelectorAll("bit-breadcrumbs button");
    expect(crumbs).toHaveLength(0);

    const pageTypeCrumb = fixture.nativeElement.querySelector(
      '[slot="breadcrumbs"] [aria-current="page"]',
    );
    expect(pageTypeCrumb.textContent.trim()).toBe("pamAccessRuleCreateTitle");

    const heading = fixture.nativeElement.querySelector("h1");
    expect(heading.textContent).toContain("pamAccessRuleCreateTitle");
  });

  it("links the event logs at the organization's reporting route", async () => {
    const fixture = await render({});

    const link = fixture.nativeElement.querySelector(
      "#access-rule-edit_anchor_event-logs",
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/organizations/org-1/reporting/events");
  });

  it("drops the event log notice for an organization without event log access", async () => {
    const fixture = await render({}, undefined, false);

    expect(fixture.nativeElement.querySelector("#access-rule-edit_anchor_event-logs")).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain("pamAccessRuleEventLogNotice");
  });
});

describe("AccessRuleEditComponent — load, collections, and submit", () => {
  let component: AccessRuleEditComponent;
  let navigate: jest.SpyInstance;
  let pamApi: {
    getAccessRule: jest.Mock;
    createAccessRule: jest.Mock;
    updateAccessRule: jest.Mock;
    deleteAccessRule: jest.Mock;
  };
  let showToast: jest.Mock;
  let dialog: { openSimpleDialog: jest.Mock };

  // The org's collections, as returned by the admin-console service.
  const ORG_COLLECTIONS = [
    { id: "col-1", name: "Engineering" },
    { id: "col-2", name: "Design" },
    { id: "col-3", name: "Finance" },
  ];

  const setup = async (state: RouteState, existing?: AccessRuleView | Error) => {
    pamApi = {
      getAccessRule:
        existing instanceof Error
          ? jest.fn().mockRejectedValue(existing)
          : jest.fn().mockResolvedValue(existing),
      createAccessRule: jest.fn().mockResolvedValue(undefined),
      updateAccessRule: jest.fn().mockResolvedValue(undefined),
      deleteAccessRule: jest.fn().mockResolvedValue(undefined),
    };
    showToast = jest.fn();
    dialog = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: providersWith(
        { provide: ActivatedRoute, useValue: routeStub(state) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        { provide: DialogService, useValue: dialog },
      ),
    });

    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccessRuleEditComponent);
    component = fixture.componentInstance;
    // Let the constructor-driven initialize() (rule fetch + collection load) settle.
    await fixture.whenStable();
  };

  const controls = () => component["formGroup"].controls;

  it("seeds the collections control by mapping an existing rule's IDs onto loaded options", async () => {
    await setup({ params: { accessRuleId: "rule-1" } }, {
      id: "rule-1",
      collections: ["col-1", "col-3"],
      conditions: [],
    } as unknown as AccessRuleView);

    expect(controls().collections.value.map((i) => i.id)).toEqual(["col-1", "col-3"]);
    // Chips show real names, not raw UUIDs.
    expect(controls().collections.value.map((i) => i.labelName)).toEqual([
      "Engineering",
      "Finance",
    ]);
  });

  it("submits the IDs of the collections held in the form control", async () => {
    await setup({});

    controls().name.setValue("Production access");
    controls().collections.setValue([
      { id: "col-2", listName: "Design", labelName: "Design", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);

    await component["submit"]();

    expect(pamApi.createAccessRule).toHaveBeenCalledTimes(1);
    const [orgId, request] = pamApi.createAccessRule.mock.calls[0];
    expect(orgId).toBe("org-1");
    expect(request.collections).toEqual(["col-2"]);
    expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
  });

  it("serialises the ipAllowlistCidrs control into an ip_allowlist condition, dropping empties", async () => {
    await setup({});

    controls().name.setValue("IP restricted");
    controls().collections.setValue([
      { id: "col-2", listName: "Design", labelName: "Design", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);
    controls().ipAllowlistEnabled.setValue(true);
    // The FormArray is seeded via the component helper (a FormArray can't be resized with
    // setValue), mirroring how the editor and load path populate rows.
    component["setIpAllowlistCidrs"](["10.0.0.0/8", "", "192.168.0.0/16"]);

    await component["submit"]();

    expect(pamApi.createAccessRule).toHaveBeenCalledTimes(1);
    const [, request] = pamApi.createAccessRule.mock.calls[0];
    expect(request.conditions).toEqual([
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
    ]);
  });

  it("carries forward condition kinds this client doesn't model when editing a rule", async () => {
    // `time_of_day` isn't a kind this client's checkboxes model (only
    // human_approval/ip_allowlist are); it stands in for any future server-side
    // condition kind the SDK passes through unrecognised.
    const existingRule = {
      id: "rule-1",
      name: "Existing rule",
      collections: ["col-2"],
      conditions: [
        { kind: "human_approval" },
        { kind: "time_of_day", tz: "UTC", windows: [] } as any,
      ],
    } as unknown as AccessRuleView;

    await setup({ params: { accessRuleId: "rule-1" } }, existingRule);

    // Edit an unrelated field to exercise the round-trip.
    controls().description.setValue("updated description");

    await component["submit"]();

    expect(pamApi.updateAccessRule).toHaveBeenCalledTimes(1);
    const [, , request] = pamApi.updateAccessRule.mock.calls[0];
    expect(request.conditions).toEqual(
      expect.arrayContaining([{ kind: "time_of_day", tz: "UTC", windows: [] }]),
    );
    // The known condition is still rebuilt from its checkbox as normal.
    expect(request.conditions).toEqual(expect.arrayContaining([{ kind: "human_approval" }]));
  });

  it("does not carry a condition stash when creating a new rule (no applyRule)", async () => {
    await setup({});

    controls().name.setValue("New rule");
    controls().collections.setValue([
      { id: "col-2", listName: "Design", labelName: "Design", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);

    await component["submit"]();

    expect(pamApi.createAccessRule).toHaveBeenCalledTimes(1);
    const [, request] = pamApi.createAccessRule.mock.calls[0];
    expect(request.conditions).toEqual([]);
  });

  it("does not submit when required fields are missing", async () => {
    await setup({});

    // No name, no collections.
    await component["submit"]();

    expect(pamApi.createAccessRule).not.toHaveBeenCalled();
  });

  it("prefills from the source rule when duplicating, but not its collections", async () => {
    await setup({ queryParams: { duplicateFrom: "rule-1" } }, {
      id: "rule-1",
      name: "Production access",
      description: "prod",
      collections: ["col-1", "col-3"],
      conditions: [{ kind: "human_approval" }, { kind: "time_of_day", tz: "UTC" } as any],
    } as unknown as AccessRuleView);

    expect(pamApi.getAccessRule).toHaveBeenCalledWith("org-1", "rule-1");
    // The i18n fake echoes the key; the real message is "$NAME$ (copy)".
    expect(controls().name.value).toBe("pamAccessRuleDuplicateName");
    expect(controls().description.value).toBe("prod");
    expect(controls().humanApprovalEnabled.value).toBe(true);
    // A collection can only carry one rule, so the source's collections would be
    // rejected on save; the duplicate starts with none selected.
    expect(controls().collections.value).toEqual([]);

    // Saving the duplicate creates a new rule (carrying the unmodelled condition), never updates the source.
    controls().name.setValue("Production access copy");
    controls().collections.setValue([
      { id: "col-2", listName: "Design", labelName: "Design", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);
    await component["submit"]();

    expect(pamApi.updateAccessRule).not.toHaveBeenCalled();
    expect(pamApi.createAccessRule).toHaveBeenCalledTimes(1);
    const [, request] = pamApi.createAccessRule.mock.calls[0];
    expect(request.conditions).toEqual(
      expect.arrayContaining([{ kind: "time_of_day", tz: "UTC" }]),
    );
  });

  it("toasts and falls back to a blank create form when the duplicate source can't load", async () => {
    await setup({ queryParams: { duplicateFrom: "gone" } }, new Error("boom"));

    expect(TestBed.inject(ToastService).showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamAccessRuleNotFound" }),
    );
    expect(controls().name.value).toBe("");
    // Unlike a failed edit-mode load, the user stays on the (now blank) create page.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the friendly collection-conflict message when the server rejects the collections", async () => {
    await setup({});
    const conflict = Object.assign(
      new Error(
        'error in response: status code 400 Bad Request: {"message":"One or more collections are already governed by another access rule."}',
      ),
      { name: "AccessRuleError", variant: "Api" },
    );
    pamApi.createAccessRule.mockRejectedValue(conflict);

    controls().name.setValue("Conflicting rule");
    controls().collections.setValue([
      { id: "col-1", listName: "Eng", labelName: "Eng", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);
    await component["submit"]();

    expect(TestBed.inject(ToastService).showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamAccessRuleCollectionConflict" }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("applies a starter template from the query param", async () => {
    await setup({ queryParams: { template: "approval-required" } });

    expect(controls().name.value).toBe("pamTemplateApprovalRequiredName");
    expect(controls().humanApprovalEnabled.value).toBe(true);
  });

  it("snaps off-preset stored max/extension durations onto their picker options", async () => {
    await setup({ params: { accessRuleId: "rule-1" } }, {
      id: "rule-1",
      name: "Off-preset durations",
      collections: [],
      conditions: [],
      defaultLeaseDurationSeconds: ONE_HOUR,
      maxLeaseDurationSeconds: 50 * 60, // 50m — not a picker option; nearest is 1h
      allowsExtensions: true,
      maxExtensionDurationSeconds: 50 * 60, // 50m — nearest extension option is 1h
    } as unknown as AccessRuleView);

    expect(controls().maxLeaseDurationSeconds.value).toBe(ONE_HOUR);
    expect(controls().maxExtensionDurationSeconds.value).toBe(ONE_HOUR);
  });

  it("deletes the rule under edit and returns to the list once confirmed", async () => {
    await setup({ params: { accessRuleId: "rule-1" } }, {
      id: "rule-1",
      name: "Existing rule",
      collections: [],
      conditions: [],
    } as unknown as AccessRuleView);

    await component["remove"]();

    expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { key: "pamAccessRuleDeleteConfirmContent", placeholders: ["Existing rule"] },
      }),
    );
    expect(pamApi.deleteAccessRule).toHaveBeenCalledWith("org-1", "rule-1");
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "pamAccessRuleDeleted" }),
    );
    expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
  });

  it("leaves the rule alone when the confirm dialog is declined", async () => {
    await setup({ params: { accessRuleId: "rule-1" } }, {
      id: "rule-1",
      name: "Existing rule",
      collections: [],
      conditions: [],
    } as unknown as AccessRuleView);
    dialog.openSimpleDialog.mockResolvedValue(false);

    await component["remove"]();

    expect(pamApi.deleteAccessRule).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not offer a delete for a rule that doesn't exist yet (create mode)", async () => {
    await setup({});

    await component["remove"]();

    expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
    expect(pamApi.deleteAccessRule).not.toHaveBeenCalled();
  });

  it("toasts when the org collections fail to load", async () => {
    showToast = jest.fn();
    pamApi = {
      getAccessRule: jest.fn(),
      createAccessRule: jest.fn(),
      updateAccessRule: jest.fn(),
      deleteAccessRule: jest.fn(),
    };

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: providersWith(
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => throwError(() => new Error("boom")) },
        },
      ),
    });

    jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccessRuleEditComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        message: "pamAccessRuleCollectionsLoadError",
      }),
    );
    // The load settled (spinner cleared) even though it failed.
    expect(component["collectionsLoading"]()).toBe(false);
  });

  it("toasts and navigates back when the edited rule can't be fetched", async () => {
    pamApi = {
      getAccessRule: jest.fn().mockRejectedValue(new Error("404")),
      createAccessRule: jest.fn(),
      updateAccessRule: jest.fn(),
      deleteAccessRule: jest.fn(),
    };
    showToast = jest.fn();

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: providersWith(
        { provide: ActivatedRoute, useValue: routeStub({ params: { accessRuleId: "missing" } }) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
      ),
    });

    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccessRuleEditComponent);
    await fixture.whenStable();

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamAccessRuleNotFound" }),
    );
    expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
  });
});

describe("AccessRuleEditComponent — form states", () => {
  let fixture: ComponentFixture<AccessRuleEditComponent>;
  let component: AccessRuleEditComponent;
  let navigate: jest.SpyInstance;
  let showToast: jest.Mock;
  let dialog: { openSimpleDialog: jest.Mock };
  let pamApi: {
    getAccessRule: jest.Mock;
    createAccessRule: jest.Mock;
    updateAccessRule: jest.Mock;
    deleteAccessRule: jest.Mock;
  };

  const ORG_COLLECTIONS = [{ id: "col-1", name: "Engineering" }];

  const render = async (state: RouteState = {}) => {
    pamApi = {
      getAccessRule: jest.fn().mockResolvedValue({
        id: "rule-1",
        name: "Existing rule",
        collections: [],
        conditions: [],
      } as unknown as AccessRuleView),
      createAccessRule: jest.fn().mockResolvedValue(undefined),
      updateAccessRule: jest.fn().mockResolvedValue(undefined),
      deleteAccessRule: jest.fn().mockResolvedValue(undefined),
    };
    showToast = jest.fn();
    dialog = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub(state) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        { provide: CidrValidationService, useValue: cidrValidationStub },
        { provide: OrganizationService, useValue: organizationServiceStub() },
        { provide: DialogService, useValue: dialog },
      ],
    });

    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(AccessRuleEditComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const controls = () => component["formGroup"].controls;

  const fillRequiredFields = () => {
    controls().name.setValue("Production access");
    controls().collections.setValue([
      {
        id: "col-1",
        listName: "Engineering",
        labelName: "Engineering",
        icon: "bwi-collection-shared",
      },
    ] satisfies SelectItemView[]);
  };

  const submitAndRender = async () => {
    await component["submit"]();
    fixture.detectChanges();
  };

  const callout = () => fixture.nativeElement.querySelector("bit-callout") as HTMLElement | null;

  describe("save error", () => {
    it("renders an inline callout instead of a toast when the save fails", async () => {
      await render();
      fillRequiredFields();
      pamApi.createAccessRule.mockRejectedValue(new Error("boom"));

      await submitAndRender();

      expect(callout()).not.toBeNull();
      expect(callout()!.textContent).toContain("pamAccessRuleSaveErrorTitle");
      expect(callout()!.textContent).toContain("pamAccessRuleSaveErrorBody");
      expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(navigate).not.toHaveBeenCalled();
    });

    it("moves focus to the callout, which renders far above the Save button", async () => {
      await render();
      fillRequiredFields();
      pamApi.createAccessRule.mockRejectedValue(new Error("boom"));

      await submitAndRender();
      await fixture.whenStable();

      expect(document.activeElement).toBe(callout());
    });

    it("keeps everything the user entered when the save fails", async () => {
      await render();
      fillRequiredFields();
      pamApi.createAccessRule.mockRejectedValue(new Error("boom"));

      await submitAndRender();

      expect(controls().name.value).toBe("Production access");
      expect(controls().collections.value.map((c) => c.id)).toEqual(["col-1"]);
    });

    it("prefers the server's own message over the generic sentence", async () => {
      await render();
      fillRequiredFields();
      const serverError = Object.assign(new Error("Rule name already in use."), {
        name: "AccessRuleError",
        variant: "Conflict",
      });
      pamApi.createAccessRule.mockRejectedValue(serverError);

      await submitAndRender();

      expect(callout()!.textContent).toContain("Rule name already in use.");
      expect(callout()!.textContent).not.toContain("pamAccessRuleSaveErrorBody");
    });

    it("clears the callout when the user resubmits", async () => {
      await render();
      fillRequiredFields();
      pamApi.createAccessRule.mockRejectedValue(new Error("boom"));
      await submitAndRender();
      expect(callout()).not.toBeNull();

      pamApi.createAccessRule.mockResolvedValue(undefined);
      await submitAndRender();

      expect(callout()).toBeNull();
      expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
    });
  });

  describe("validation summary", () => {
    it("summarises the invalid fields when an incomplete form is submitted", async () => {
      await render();

      await submitAndRender();

      const summary = fixture.nativeElement.querySelector("bit-error-summary") as HTMLElement;
      expect(summary.textContent).toContain("fieldsNeedAttention");
      expect(pamApi.createAccessRule).not.toHaveBeenCalled();
    });

    it("shows no summary before the form has been submitted", async () => {
      await render();

      const summary = fixture.nativeElement.querySelector("bit-error-summary") as HTMLElement;
      expect(summary.textContent!.trim()).toBe("");
    });
  });

  describe("discard confirmation", () => {
    it("leaves a pristine form without asking", async () => {
      await render();

      await component["cancel"]();

      expect(dialog.openSimpleDialog).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
    });

    it("confirms before discarding a form the user has typed into", async () => {
      await render();
      controls().name.setValue("Half-finished rule");
      controls().name.markAsDirty();

      await component["cancel"]();

      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "pamAccessRuleDiscardTitle" },
          content: { key: "pamAccessRuleDiscardContent" },
          acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
          cancelButtonText: { key: "cancel" },
          type: "warning",
        }),
      );
      expect(navigate).toHaveBeenCalledWith([".."], expect.objectContaining({}));
    });

    it("names the edits, not the rule, when an existing rule is being edited", async () => {
      await render({ params: { accessRuleId: "rule-1" } });
      controls().name.setValue("Renamed rule");
      controls().name.markAsDirty();

      await component["cancel"]();

      expect(dialog.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "discardEditsTitle" },
          acceptButtonText: { key: "discardEdits" },
          cancelButtonText: { key: "keepEditing" },
        }),
      );
    });

    it("stays on the form with its values intact when the dialog is dismissed", async () => {
      await render();
      controls().name.setValue("Half-finished rule");
      controls().name.markAsDirty();
      dialog.openSimpleDialog.mockResolvedValue(false);

      await component["cancel"]();

      expect(navigate).not.toHaveBeenCalled();
      expect(controls().name.value).toBe("Half-finished rule");
    });

    it("asks again when the route is left by any other means", async () => {
      await render();
      controls().name.setValue("Half-finished rule");
      controls().name.markAsDirty();
      dialog.openSimpleDialog.mockResolvedValue(false);

      await expect(component.confirmDiscard()).resolves.toBe(false);
      expect(dialog.openSimpleDialog).toHaveBeenCalled();
    });

    it("does not ask a second time for the navigation Cancel already confirmed", async () => {
      await render();
      controls().name.setValue("Half-finished rule");
      controls().name.markAsDirty();
      navigate.mockImplementation(async () => {
        expect(await component.confirmDiscard()).toBe(true);
        return true;
      });

      await component["cancel"]();

      expect(dialog.openSimpleDialog).toHaveBeenCalledTimes(1);
    });
  });
});
