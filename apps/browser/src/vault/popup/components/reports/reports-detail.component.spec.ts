import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { AlertExclusionId, CipherId, UserId } from "@bitwarden/common/types/guid";
import {
  CipherRiskCounts,
  PersonalVaultRiskSummary,
} from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AlertExclusionService } from "@bitwarden/common/vault/alert-exclusions";
import { CipherRiskTypes } from "@bitwarden/common/vault/enums/cipher-risk-types";
import { AlertExclusionData } from "@bitwarden/common/vault/models/data/alert-exclusion.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  DefaultChangeLoginPasswordService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";
import {
  PersonalVaultAlertService,
  PersonalVaultAlertSummary,
} from "../../services/personal-vault-alert.service";

import { ReportsDetailComponent, ReportType } from "./reports-detail.component";
import {
  RiskConfirmationDialogComponent,
  RiskConfirmationDialogResult,
} from "./risk-confirmation-dialog/risk-confirmation-dialog.component";

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "popup-page", template: `<ng-content></ng-content>` })
class MockPopupPageComponent {}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "popup-header", template: `<ng-content></ng-content>` })
class MockPopupHeaderComponent {
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle = "";
}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "app-pop-out", template: "" })
class MockPopOutComponent {}

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ selector: "app-current-account", template: "" })
class MockCurrentAccountComponent {}

function loginCipher(id: string): CipherView {
  const c = new CipherView();
  c.id = id;
  return c;
}

function exclusionData(id: string, cipherId: string): AlertExclusionData {
  return {
    id: id as AlertExclusionId,
    cipherId: cipherId as CipherId,
    excludedAt: new Date(),
    notes: null,
  } as AlertExclusionData;
}

describe("ReportsDetailComponent", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let fixture: ComponentFixture<ReportsDetailComponent>;
  let component: ReportsDetailComponent;

  let summary$: BehaviorSubject<PersonalVaultAlertSummary>;
  let rawSummary$: BehaviorSubject<PersonalVaultRiskSummary>;
  let exclusions$: BehaviorSubject<AlertExclusionData[]>;
  let routeData$: BehaviorSubject<{ type: ReportType }>;

  let alertService: MockProxy<PersonalVaultAlertService>;
  let alertExclusionService: MockProxy<AlertExclusionService>;
  let cipherService: MockProxy<CipherService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let changeLoginPasswordService: MockProxy<ChangeLoginPasswordService>;
  let popupRouterCacheService: MockProxy<PopupRouterCacheService>;
  let router: MockProxy<Router>;

  function makeRawSummary(
    overrides: Partial<PersonalVaultRiskSummary> = {},
  ): PersonalVaultRiskSummary {
    return {
      exposed: [],
      weak: [],
      reused: [],
      riskCounts: new Map<CipherId, CipherRiskCounts>(),
      scannedAt: new Date("2026-05-14T00:00:00Z"),
      ...overrides,
    };
  }

  function makeSummary(
    overrides: Partial<PersonalVaultAlertSummary> = {},
  ): PersonalVaultAlertSummary {
    return {
      ...makeRawSummary(),
      totalCount: 0,
      ...overrides,
    };
  }

  async function setup(type: ReportType = "exposed"): Promise<void> {
    summary$ = new BehaviorSubject<PersonalVaultAlertSummary>(makeSummary());
    rawSummary$ = new BehaviorSubject<PersonalVaultRiskSummary>(makeRawSummary());
    exclusions$ = new BehaviorSubject<AlertExclusionData[]>([]);
    routeData$ = new BehaviorSubject<{ type: ReportType }>({ type });

    alertService = mock<PersonalVaultAlertService>();
    (alertService as any).summary$ = summary$;
    (alertService as any).rawSummary$ = rawSummary$;

    alertExclusionService = mock<AlertExclusionService>();
    alertExclusionService.exclusions$.mockReturnValue(exclusions$);
    alertExclusionService.exclude.mockResolvedValue(undefined);
    alertExclusionService.removeExclusion.mockResolvedValue(undefined);

    cipherService = mock<CipherService>();
    cipherService.softDeleteWithServer.mockResolvedValue(undefined);

    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

    changeLoginPasswordService = mock<ChangeLoginPasswordService>();

    popupRouterCacheService = mock<PopupRouterCacheService>();
    popupRouterCacheService.setHistory.mockResolvedValue([]);

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ReportsDetailComponent, RouterTestingModule],
      providers: [
        { provide: PersonalVaultAlertService, useValue: alertService },
        { provide: AlertExclusionService, useValue: alertExclusionService },
        { provide: CipherService, useValue: cipherService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: PopupRouterCacheService, useValue: popupRouterCacheService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { data: routeData$ } },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: string[]) =>
              args.length > 0 ? `${key}:${args.join(",")}` : key,
            translate: (key: string) => key,
            translationLocale: "en",
          },
        },
      ],
    })
      .overrideComponent(ReportsDetailComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
          ],
          providers: [
            { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
          ],
          providers: [
            { provide: ChangeLoginPasswordService, useValue: changeLoginPasswordService },
          ],
        },
      })
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();

    fixture = TestBed.createComponent(ReportsDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe("data$", () => {
    it.each([
      ["exposed", "exposedPasswords", "exposedPasswordsDetailDesc"],
      ["weak", "weakPasswords", "weakPasswordsDetailDesc"],
      ["reused", "reusedPasswords", "reusedPasswordsDetailDesc"],
    ] as Array<[ReportType, string, string]>)(
      "for %s, emits titleKey=%s and descKey=%s",
      async (type, titleKey, descKey) => {
        await setup(type);

        const data = await firstValueFrom((component as any).data$);
        expect(data).toEqual({ type, titleKey, descKey });
      },
    );

    it("navigates back to /tabs/reports when route data carries an unknown type", async () => {
      await setup("exposed");
      router.navigate.mockClear();

      routeData$.next({ type: "garbage" as ReportType });

      expect(router.navigate).toHaveBeenCalledWith(["/tabs/reports"]);
    });
  });

  describe("ciphers$", () => {
    it("selects summary[type] based on route data", async () => {
      await setup("weak");
      const a = loginCipher("a");
      const b = loginCipher("b");
      summary$.next(makeSummary({ exposed: [], weak: [a, b], reused: [], totalCount: 2 }));

      const ciphers = await firstValueFrom((component as any).ciphers$);
      expect(ciphers).toEqual([a, b]);
    });
  });

  describe("excludedItems$", () => {
    it("joins exclusions against rawSummary[type] and keeps only matches still in raw", async () => {
      await setup("exposed");
      const a = loginCipher("a");
      const b = loginCipher("b");
      rawSummary$.next(makeRawSummary({ exposed: [a, b] }));
      exclusions$.next([
        exclusionData("e1", "a"),
        // "z" is an exclusion whose cipher no longer appears in the raw summary for this type.
        exclusionData("e2", "z"),
      ]);

      const items = (await firstValueFrom((component as any).excludedItems$)) as Array<{
        exclusion: { id: string };
        cipher: CipherView;
      }>;
      expect(items).toHaveLength(1);
      expect(items[0].exclusion.id).toBe("e1");
      expect(items[0].cipher).toBe(a);
    });
  });

  describe("toggleExcluded", () => {
    it("flips the excludedOpen signal", async () => {
      await setup();
      const excludedOpen = (component as any).excludedOpen;
      expect(excludedOpen()).toBe(false);

      component["toggleExcluded"]();
      expect(excludedOpen()).toBe(true);

      component["toggleExcluded"]();
      expect(excludedOpen()).toBe(false);
    });
  });

  describe("viewCipher", () => {
    it("returns early when passwordRepromptCheck fails", async () => {
      await setup();
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

      await component.viewCipher(loginCipher("a"));

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("navigates to /view-cipher with cipherId and type when reprompt passes", async () => {
      await setup();
      const cipher = loginCipher("a");
      cipher.type = 1 as any;

      await component.viewCipher(cipher);

      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "a", type: 1 },
      });
    });
  });

  describe("changePassword", () => {
    let sendMessageSpy: jest.SpyInstance;

    beforeEach(() => {
      sendMessageSpy = jest.spyOn(BrowserApi, "sendMessage").mockReturnValue(undefined as any);
    });

    afterEach(() => {
      sendMessageSpy.mockRestore();
    });

    it("sends bgQueueChangePasswordReminder with the resolved URL", async () => {
      await setup();
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
        "https://example.com/reset",
      );

      await component.changePassword(loginCipher("a"));

      expect(sendMessageSpy).toHaveBeenCalledWith("bgQueueChangePasswordReminder", {
        url: "https://example.com/reset",
      });
    });

    it("clears the popup router cache so the next popup open lands on /tabs/vault", async () => {
      await setup();
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
        "https://example.com/reset",
      );

      await component.changePassword(loginCipher("a"));

      expect(popupRouterCacheService.setHistory).toHaveBeenCalledWith([]);
    });

    it("clears the cache BEFORE sending the queue message, so the storage write flushes before the popup is torn down", async () => {
      await setup();
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
        "https://example.com/reset",
      );

      await component.changePassword(loginCipher("a"));

      const setHistoryOrder = popupRouterCacheService.setHistory.mock.invocationCallOrder[0];
      const sendMessageOrder = sendMessageSpy.mock.invocationCallOrder[0];
      expect(setHistoryOrder).toBeLessThan(sendMessageOrder);
    });

    it("does NOT send the queue message when getChangePasswordUrl returns null", async () => {
      await setup();
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(null);

      await component.changePassword(loginCipher("a"));

      expect(sendMessageSpy).not.toHaveBeenCalled();
    });

    it("does NOT clear the popup router cache when no URL is found", async () => {
      await setup();
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(null);

      await component.changePassword(loginCipher("a"));

      expect(popupRouterCacheService.setHistory).not.toHaveBeenCalled();
    });
  });

  describe("exclude", () => {
    let openSpy: jest.SpyInstance;

    afterEach(() => {
      openSpy?.mockRestore();
    });

    function stubDialog(result: RiskConfirmationDialogResult) {
      openSpy = jest
        .spyOn(RiskConfirmationDialogComponent, "open")
        .mockReturnValue({ closed: of(result) } as any);
    }

    it("opens RiskConfirmationDialog with the exclude copy and the cipher's riskCounts", async () => {
      await setup();
      rawSummary$.next(
        makeRawSummary({
          riskCounts: new Map<CipherId, CipherRiskCounts>([
            ["a" as CipherId, { exposedBreaches: 5, reuseCount: 2, weak: true }],
          ]),
        }),
      );
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.exclude("a");

      expect(openSpy).toHaveBeenCalledWith(dialogService, {
        titleKey: "excludeThisRisk",
        descriptionKey: "excludeThisRiskDesc",
        acceptButtonKey: "yesExcludeRisk",
        acceptButtonType: "primary",
        risks: { exposedBreaches: 5, reuseCount: 2, weak: true },
      });
    });

    it("uses the default risk counts when the cipher is missing from the summary", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.exclude("missing");

      expect(openSpy.mock.calls[0][1].risks).toEqual({
        exposedBreaches: 0,
        reuseCount: 1,
        weak: false,
      });
    });

    it("calls exclusionService.exclude only when the dialog returns Accepted", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.exclude("a");

      expect(alertExclusionService.exclude).toHaveBeenCalledWith("a", userId, CipherRiskTypes.None);
    });

    it("does NOT call exclusionService.exclude when the dialog is Canceled", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Canceled);

      await component.exclude("a");

      expect(alertExclusionService.exclude).not.toHaveBeenCalled();
    });

    it("passes a CipherRiskTypes mask reflecting all current risks for the cipher", async () => {
      await setup();
      rawSummary$.next(
        makeRawSummary({
          riskCounts: new Map<CipherId, CipherRiskCounts>([
            ["a" as CipherId, { exposedBreaches: 3, reuseCount: 4, weak: true }],
          ]),
        }),
      );
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.exclude("a");

      const expectedMask = CipherRiskTypes.Exposed | CipherRiskTypes.Weak | CipherRiskTypes.Reused;
      expect(alertExclusionService.exclude).toHaveBeenCalledWith("a", userId, expectedMask);
    });

    it("omits flags for risks the cipher does not currently have", async () => {
      await setup();
      rawSummary$.next(
        makeRawSummary({
          riskCounts: new Map<CipherId, CipherRiskCounts>([
            // Weak only — no breach, no reuse.
            ["a" as CipherId, { exposedBreaches: 0, reuseCount: 1, weak: true }],
          ]),
        }),
      );
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.exclude("a");

      expect(alertExclusionService.exclude).toHaveBeenCalledWith("a", userId, CipherRiskTypes.Weak);
    });
  });

  describe("delete", () => {
    let openSpy: jest.SpyInstance;

    afterEach(() => {
      openSpy?.mockRestore();
    });

    function stubDialog(result: RiskConfirmationDialogResult) {
      openSpy = jest
        .spyOn(RiskConfirmationDialogComponent, "open")
        .mockReturnValue({ closed: of(result) } as any);
    }

    it("returns early when passwordRepromptCheck fails (no dialog opened)", async () => {
      await setup();
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.delete(loginCipher("a"));

      expect(openSpy).not.toHaveBeenCalled();
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("returns early when the confirmation dialog is Canceled", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Canceled);

      await component.delete(loginCipher("a"));

      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("soft-deletes and shows a success toast when accepted", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.delete(loginCipher("a"));

      expect(cipherService.softDeleteWithServer).toHaveBeenCalledWith("a", userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "deletedItem",
      });
    });

    it("opens the confirmation dialog with the danger button type and deleteThisRisk copy", async () => {
      await setup();
      stubDialog(RiskConfirmationDialogResult.Accepted);

      await component.delete(loginCipher("a"));

      expect(openSpy.mock.calls[0][1]).toMatchObject({
        titleKey: "deleteThisRisk",
        descriptionKey: "deleteThisItemDesc",
        acceptButtonKey: "yesDeleteItem",
        acceptButtonType: "danger",
      });
    });
  });

  describe("removeExclusion", () => {
    it("calls exclusionService.removeExclusion with the exclusion id and userId", async () => {
      await setup();

      await component.removeExclusion("exclusion-1" as AlertExclusionId);

      expect(alertExclusionService.removeExclusion).toHaveBeenCalledWith("exclusion-1", userId);
    });
  });
});
