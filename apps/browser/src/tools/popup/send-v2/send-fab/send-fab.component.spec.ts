import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { IconModule, MenuModule } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { VaultFabComponent } from "@bitwarden/vault";

import { SendFabComponent } from "./send-fab.component";

describe("SendFabComponent", () => {
  let fixture: ComponentFixture<SendFabComponent>;
  let component: SendFabComponent;
  let router: Router;
  let premiumUpgradePromptServiceMock: jest.Mocked<PremiumUpgradePromptService>;

  const allowedSendTypes$ = new BehaviorSubject<SendType[]>([SendType.Text, SendType.File]);
  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(true);

  const ACTIVE_ACCOUNT_ID = "account-1" as any;

  beforeEach(async () => {
    premiumUpgradePromptServiceMock = mock<PremiumUpgradePromptService>();

    await TestBed.configureTestingModule({
      imports: [
        SendFabComponent,
        JslibModule,
        VaultFabComponent,
        MenuModule,
        IconModule,
        PremiumBadgeComponent,
      ],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptServiceMock },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: ACTIVE_ACCOUNT_ID }),
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => hasPremiumFromAnySource$ },
        },
        {
          provide: SendPolicyService,
          useValue: { allowedSendTypes$: allowedSendTypes$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendFabComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture.detectChanges();
  });

  describe("navigateToTextSend", () => {
    it("navigates to /add-send with type Text", async () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToTextSend"]();

      expect(navigate).toHaveBeenCalledWith(["/add-send"], {
        queryParams: { type: SendType.Text, isNew: true },
      });
    });
  });

  describe("navigateToFileSend", () => {
    it("navigates to /add-send with type File when user has premium", async () => {
      hasPremiumFromAnySource$.next(true);
      fixture.detectChanges();
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToFileSend"]();

      expect(navigate).toHaveBeenCalledWith(["/add-send"], {
        queryParams: { type: SendType.File, isNew: true },
      });
      expect(premiumUpgradePromptServiceMock.promptForPremium).not.toHaveBeenCalled();
    });

    it("prompts for premium instead of navigating when user lacks premium", async () => {
      hasPremiumFromAnySource$.next(false);
      fixture.detectChanges();
      premiumUpgradePromptServiceMock.promptForPremium.mockResolvedValue(undefined);
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToFileSend"]();

      expect(premiumUpgradePromptServiceMock.promptForPremium).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("navigateToRestrictedSend", () => {
    it("navigates to text send when the only allowed type is Text", async () => {
      allowedSendTypes$.next([SendType.Text]);
      fixture.detectChanges();
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToRestrictedSend"]();

      expect(navigate).toHaveBeenCalledWith(["/add-send"], {
        queryParams: { type: SendType.Text, isNew: true },
      });
    });

    it("navigates to file send when the only allowed type is File (and user has premium)", async () => {
      allowedSendTypes$.next([SendType.File]);
      hasPremiumFromAnySource$.next(true);
      fixture.detectChanges();
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToRestrictedSend"]();

      expect(navigate).toHaveBeenCalledWith(["/add-send"], {
        queryParams: { type: SendType.File, isNew: true },
      });
    });

    it("prompts for premium when the only allowed type is File but user lacks premium", async () => {
      allowedSendTypes$.next([SendType.File]);
      hasPremiumFromAnySource$.next(false);
      fixture.detectChanges();
      premiumUpgradePromptServiceMock.promptForPremium.mockResolvedValue(undefined);
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component["navigateToRestrictedSend"]();

      expect(premiumUpgradePromptServiceMock.promptForPremium).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("allowedSendTypes signal", () => {
    it("shows a single FAB button when only one send type is allowed", () => {
      allowedSendTypes$.next([SendType.Text]);
      fixture.detectChanges();

      // With one type the @if renders the direct-action button (no menu trigger).
      const buttons = fixture.nativeElement.querySelectorAll("button[type=button]");
      // The single-type branch renders one button; no bit-menu.
      expect(fixture.nativeElement.querySelector("bit-menu")).toBeNull();
      expect(buttons.length).toBe(1);
    });

    it("shows a menu trigger when both send types are allowed", () => {
      allowedSendTypes$.next([SendType.Text, SendType.File]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-menu")).not.toBeNull();
    });
  });
});
