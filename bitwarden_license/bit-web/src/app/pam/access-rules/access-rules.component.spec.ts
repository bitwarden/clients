import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Params, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { AccessRuleResponse, PamApiService } from "@bitwarden/pam";

import { AccessRuleDialogComponent, AccessRuleDialogResult } from "./access-rule-dialog.component";
import { AccessRulesComponent } from "./access-rules.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function rule(id: string, name = "Rule"): AccessRuleResponse {
  return new AccessRuleResponse({
    Id: id,
    OrganizationId: "org-1",
    Name: name,
    Enabled: true,
    Collections: [],
    Conditions: [],
    SingleActiveLease: false,
    CreationDate: "2024-01-01T00:00:00.000Z",
    RevisionDate: "2024-01-01T00:00:00.000Z",
  });
}

describe("AccessRulesComponent — URL-driven rule dialog", () => {
  let listAccessRules: jest.Mock;
  let openDialog: jest.SpyInstance;
  let closeDialog: jest.Mock;
  let navigate: jest.SpyInstance;
  let showToast: jest.Mock;
  let queryParams$: BehaviorSubject<Params>;
  let closed$: Subject<AccessRuleDialogResult | undefined>;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = async (
    accessRuleId: string | undefined,
    rules: AccessRuleResponse[],
  ): Promise<ComponentFixture<AccessRulesComponent>> => {
    listAccessRules = jest.fn().mockResolvedValue({ data: rules });
    showToast = jest.fn();
    queryParams$ = new BehaviorSubject<Params>(accessRuleId == null ? {} : { accessRuleId });

    // A controllable dialog ref: close() completes `closed$`, mirroring how the real
    // dialog resolves when dismissed; tests can also complete it to mimic a UI close.
    closed$ = new Subject<AccessRuleDialogResult | undefined>();
    closeDialog = jest.fn(() => {
      closed$.next(undefined);
      closed$.complete();
    });
    openDialog = jest.spyOn(AccessRuleDialogComponent, "open").mockReturnValue({
      closed: closed$.asObservable(),
      close: closeDialog,
    } as unknown as ReturnType<typeof AccessRuleDialogComponent.open>);

    // The component's own template pulls in the full table/toolbar stack; replace it
    // so these tests exercise the dialog/URL logic, not the rendering of child widgets.
    TestBed.overrideComponent(AccessRulesComponent, { set: { template: "" } });

    TestBed.configureTestingModule({
      imports: [AccessRulesComponent],
      providers: [
        // A real router (so `router.events` exists for the injector chain); only
        // `navigate` is spied. ActivatedRoute is overridden below to feed our params.
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }), queryParams: queryParams$ },
        },
        { provide: PamApiService, useValue: { listAccessRules } },
        { provide: DialogService, useValue: {} },
        { provide: ToastService, useValue: { showToast } },
        { provide: I18nService, useValue: i18nFake },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ],
    });

    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    const fixture = TestBed.createComponent(AccessRulesComponent);
    // Cycle change detection + microtasks so the org-driven reload resolves and the
    // queryParams-driven dialog reconciliation runs to completion.
    await flush(fixture);
    return fixture;
  };

  const flush = async (fixture: ComponentFixture<AccessRulesComponent>): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  it("opens the edit dialog for the rule named by the accessRuleId param", async () => {
    await setup("rule-2", [rule("rule-1"), rule("rule-2", "Target")]);

    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(openDialog.mock.calls[0][1].data.existing.id).toBe("rule-2");
  });

  it("clears the param when the dialog is closed from its UI", async () => {
    const fixture = await setup("rule-2", [rule("rule-2", "Target")]);

    // Simulate the dialog being dismissed by the user.
    closed$.next(undefined);
    closed$.complete();
    await flush(fixture);

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { accessRuleId: null }, replaceUrl: true }),
    );
  });

  it("routes to the rule (pushing history) when a rule is clicked", async () => {
    const fixture = await setup(undefined, [rule("rule-1", "VPN")]);

    await fixture.componentInstance["openEdit"](rule("rule-1", "VPN"));

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { accessRuleId: "rule-1" },
        queryParamsHandling: "merge",
      }),
    );
    // No replaceUrl — clicking adds a history entry so browser-back closes the dialog.
    expect(navigate.mock.calls[0][1].replaceUrl).toBeUndefined();
  });

  it("closes the dialog when the param is removed (browser back)", async () => {
    const fixture = await setup("rule-1", [rule("rule-1", "VPN")]);
    expect(openDialog).toHaveBeenCalledTimes(1);

    // Back-navigation drops the param; the dialog should close without re-clearing it.
    queryParams$.next({});
    await flush(fixture);

    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows a not-found toast and clears the param for a stale rule id", async () => {
    await setup("missing", [rule("rule-1")]);

    expect(openDialog).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "pamAccessRuleNotFound" }),
    );
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { accessRuleId: null } }),
    );
  });

  it("does nothing when no accessRuleId is present", async () => {
    await setup(undefined, [rule("rule-1")]);

    expect(openDialog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
