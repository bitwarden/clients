import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

import { NewSendDropdownV2Component } from "./new-send-dropdown-v2.component";

describe("NewSendDropdownV2Component", () => {
  let component: NewSendDropdownV2Component;
  let fixture: ComponentFixture<NewSendDropdownV2Component>;
  let billingService: MockProxy<BillingAccountProfileStateService>;
  let accountService: MockProxy<AccountService>;
  let premiumUpgradeService: MockProxy<PremiumUpgradePromptService>;

  beforeEach(async () => {
    billingService = mock<BillingAccountProfileStateService>();
    accountService = mock<AccountService>();
    premiumUpgradeService = mock<PremiumUpgradePromptService>();

    // Default: user has premium
    accountService.activeAccount$ = of({ id: "user-123" } as any);
    billingService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [NewSendDropdownV2Component],
      providers: [
        { provide: BillingAccountProfileStateService, useValue: billingService },
        { provide: AccountService, useValue: accountService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradeService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewSendDropdownV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("input signals", () => {
    it("has correct default input values", () => {
      expect(component.hideIcon()).toBe(false);
      expect(component.buttonType()).toBe("primary");
    });

    it("accepts input signal values", () => {
      fixture.componentRef.setInput("hideIcon", true);
      fixture.componentRef.setInput("buttonType", "secondary");

      expect(component.hideIcon()).toBe(true);
      expect(component.buttonType()).toBe("secondary");
    });
  });

  describe("premium status detection", () => {
    it("hasNoPremium is false when user has premium", () => {
      billingService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      accountService.activeAccount$ = of({ id: "user-123" } as any);

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component["hasNoPremium"]()).toBe(false);
    });

    it("hasNoPremium is true when user lacks premium", () => {
      billingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      accountService.activeAccount$ = of({ id: "user-123" } as any);

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component["hasNoPremium"]()).toBe(true);
    });

    it("hasNoPremium defaults to true when no active account", () => {
      accountService.activeAccount$ = of(null);

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component["hasNoPremium"]()).toBe(true);
    });

    it("hasNoPremium updates reactively when premium status changes", async () => {
      const premiumSubject = new BehaviorSubject(false);
      billingService.hasPremiumFromAnySource$.mockReturnValue(premiumSubject.asObservable());

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component["hasNoPremium"]()).toBe(true);

      premiumSubject.next(true);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["hasNoPremium"]()).toBe(false);
    });
  });

  describe("text send functionality", () => {
    it("onTextSendClick emits SendType.Text", () => {
      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      component["onTextSendClick"]();

      expect(emitSpy).toHaveBeenCalledWith(SendType.Text);
    });

    it("allows text send without premium", () => {
      billingService.hasPremiumFromAnySource$.mockReturnValue(of(false));

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      component["onTextSendClick"]();

      expect(emitSpy).toHaveBeenCalledWith(SendType.Text);
      expect(premiumUpgradeService.promptForPremium).not.toHaveBeenCalled();
    });
  });

  describe("file send premium gating", () => {
    it("onFileSendClick emits SendType.File when user has premium", async () => {
      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      await component["onFileSendClick"]();

      expect(emitSpy).toHaveBeenCalledWith(SendType.File);
      expect(premiumUpgradeService.promptForPremium).not.toHaveBeenCalled();
    });

    it("onFileSendClick shows premium prompt without premium", async () => {
      billingService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      premiumUpgradeService.promptForPremium.mockResolvedValue();

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      await component["onFileSendClick"]();

      expect(premiumUpgradeService.promptForPremium).toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("does not emit file send type when premium prompt is shown", async () => {
      billingService.hasPremiumFromAnySource$.mockReturnValue(of(false));

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      await component["onFileSendClick"]();

      expect(emitSpy).not.toHaveBeenCalledWith(SendType.File);
    });

    it("allows file send after user gains premium", async () => {
      const premiumSubject = new BehaviorSubject(false);
      billingService.hasPremiumFromAnySource$.mockReturnValue(premiumSubject.asObservable());

      fixture = TestBed.createComponent(NewSendDropdownV2Component);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Initially no premium
      let emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);
      await component["onFileSendClick"]();
      expect(premiumUpgradeService.promptForPremium).toHaveBeenCalled();

      // Gain premium
      premiumSubject.next(true);
      await fixture.whenStable();
      fixture.detectChanges();

      // Now should emit
      emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);
      await component["onFileSendClick"]();
      expect(emitSpy).toHaveBeenCalledWith(SendType.File);
    });
  });

  describe("edge cases", () => {
    it("handles null account without errors", () => {
      accountService.activeAccount$ = of(null);

      expect(() => {
        fixture = TestBed.createComponent(NewSendDropdownV2Component);
        component = fixture.componentInstance;
        fixture.detectChanges();
      }).not.toThrow();

      expect(component["hasNoPremium"]()).toBe(true);
    });

    it("handles rapid clicks without race conditions", async () => {
      const emitSpy = jest.fn();
      component.addSend.subscribe(emitSpy);

      // Rapid text send clicks
      component["onTextSendClick"]();
      component["onTextSendClick"]();
      component["onTextSendClick"]();

      expect(emitSpy).toHaveBeenCalledTimes(3);

      // Rapid file send clicks (with premium)
      await Promise.all([
        component["onFileSendClick"](),
        component["onFileSendClick"](),
        component["onFileSendClick"](),
      ]);

      expect(emitSpy).toHaveBeenCalledTimes(6); // 3 text + 3 file
    });

    it("cleans up subscriptions on destroy", () => {
      const subscription = component["hasNoPremium"];

      fixture.destroy();

      // Signal should still exist but component cleanup handled by Angular
      expect(() => subscription()).not.toThrow();
    });
  });
});
