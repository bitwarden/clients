import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, SelectItemView, ToastService } from "@bitwarden/components";
import { AccessRuleResponse, PamApiService } from "@bitwarden/pam";

import { AccessRuleDialogComponent, AccessRuleDialogData } from "./access-rule-dialog.component";

/** Echoes the key as its translation so the form-field components don't crash on missing keys. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

// Preset durations offered by the pickers, in seconds.
const THIRTY_MIN = 30 * 60;
const ONE_HOUR = 60 * 60;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const NO_CAP = 0;

describe("AccessRuleDialogComponent — default/max duration coupling", () => {
  let fixture: ComponentFixture<AccessRuleDialogComponent>;
  let component: AccessRuleDialogComponent;

  const setup = (data: AccessRuleDialogData) => {
    TestBed.configureTestingModule({
      imports: [AccessRuleDialogComponent, ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: jest.fn() } },
        { provide: PamApiService, useValue: {} },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of(null) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ],
    });

    fixture = TestBed.createComponent(AccessRuleDialogComponent);
    component = fixture.componentInstance;
    // Intentionally no detectChanges(): the coupling is wired in the constructor, and
    // skipping ngOnInit avoids the unrelated async collection load.
  };

  // Defaults for a brand-new rule: default = 1h, max = "no maximum".
  beforeEach(() => setup({ organizationId: "org-1" }));

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

describe("AccessRuleDialogComponent — collection selection", () => {
  let component: AccessRuleDialogComponent;
  let pamApi: { createAccessRule: jest.Mock; updateAccessRule: jest.Mock };

  // The org's collections, as returned by the admin-console service.
  const ORG_COLLECTIONS = [
    { id: "col-1", name: "Engineering" },
    { id: "col-2", name: "Design" },
    { id: "col-3", name: "Finance" },
  ];

  const setup = (data: AccessRuleDialogData) => {
    pamApi = {
      createAccessRule: jest.fn().mockResolvedValue(undefined),
      updateAccessRule: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AccessRuleDialogComponent, ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: jest.fn() } },
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
      ],
    });

    component = TestBed.createComponent(AccessRuleDialogComponent).componentInstance;
  };

  const controls = () => component["formGroup"].controls;

  it("seeds the collections control by mapping an existing rule's IDs onto loaded options", async () => {
    setup({
      organizationId: "org-1",
      existing: {
        id: "rule-1",
        collections: ["col-1", "col-3"],
        conditions: [],
      } as unknown as AccessRuleResponse,
    });

    await component.ngOnInit();

    expect(controls().collections.value.map((i) => i.id)).toEqual(["col-1", "col-3"]);
    // Chips show real names, not raw UUIDs.
    expect(controls().collections.value.map((i) => i.labelName)).toEqual([
      "Engineering",
      "Finance",
    ]);
  });

  it("submits the IDs of the collections held in the form control", async () => {
    setup({ organizationId: "org-1" });
    await component.ngOnInit();

    controls().name.setValue("Production access");
    controls().collections.setValue([
      { id: "col-2", listName: "Design", labelName: "Design", icon: "bwi-collection-shared" },
    ] satisfies SelectItemView[]);

    await component["submit"]();

    expect(pamApi.createAccessRule).toHaveBeenCalledTimes(1);
    const [orgId, request] = pamApi.createAccessRule.mock.calls[0];
    expect(orgId).toBe("org-1");
    expect(request.collections).toEqual(["col-2"]);
  });
});
