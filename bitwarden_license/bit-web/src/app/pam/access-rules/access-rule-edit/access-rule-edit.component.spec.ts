import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SelectItemView, ToastService } from "@bitwarden/components";

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

describe("AccessRuleEditComponent — default/max duration coupling", () => {
  let fixture: ComponentFixture<AccessRuleEditComponent>;
  let component: AccessRuleEditComponent;

  const setup = () => {
    // These tests exercise the form/coupling logic, not the header/section rendering.
    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub({}) },
        { provide: AccessRuleSdkService, useValue: {} },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
        { provide: CidrValidationService, useValue: cidrValidationStub },
      ],
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

describe("AccessRuleEditComponent — load, collections, and submit", () => {
  let component: AccessRuleEditComponent;
  let navigate: jest.SpyInstance;
  let pamApi: {
    getAccessRule: jest.Mock;
    createAccessRule: jest.Mock;
    updateAccessRule: jest.Mock;
  };

  // The org's collections, as returned by the admin-console service.
  const ORG_COLLECTIONS = [
    { id: "col-1", name: "Engineering" },
    { id: "col-2", name: "Design" },
    { id: "col-3", name: "Finance" },
  ];

  const setup = async (state: RouteState, existing?: AccessRuleView) => {
    pamApi = {
      getAccessRule: jest.fn().mockResolvedValue(existing),
      createAccessRule: jest.fn().mockResolvedValue(undefined),
      updateAccessRule: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub(state) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        { provide: CidrValidationService, useValue: cidrValidationStub },
      ],
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

  it("toasts when the org collections fail to load", async () => {
    const showToast = jest.fn();
    pamApi = {
      getAccessRule: jest.fn(),
      createAccessRule: jest.fn(),
      updateAccessRule: jest.fn(),
    };

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub({}) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => throwError(() => new Error("boom")) },
        },
        { provide: CidrValidationService, useValue: cidrValidationStub },
      ],
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
    };
    const showToast = jest.fn();

    TestBed.overrideComponent(AccessRuleEditComponent, { set: { template: "" } });
    TestBed.configureTestingModule({
      imports: [AccessRuleEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub({ params: { accessRuleId: "missing" } }) },
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
        { provide: CidrValidationService, useValue: cidrValidationStub },
      ],
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
