import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";

import { VaultNudgesService, VaultNudgeType } from "../../../services/vault-nudges.service";

import { NewItemNudgeComponent } from "./new-item-nudge.component";

describe("NewItemNudgeComponent", () => {
  let component: NewItemNudgeComponent;
  let fixture: ComponentFixture<NewItemNudgeComponent>;

  let i18nService: MockProxy<I18nService>;
  let accountService: MockProxy<AccountService>;
  let vaultNudgesService: MockProxy<VaultNudgesService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>({ t: (key: string) => key });
    accountService = mock<AccountService>();
    vaultNudgesService = mock<VaultNudgesService>();

    await TestBed.configureTestingModule({
      imports: [NewItemNudgeComponent, CommonModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: accountService },
        { provide: VaultNudgesService, useValue: vaultNudgesService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewItemNudgeComponent);
    component = fixture.componentInstance;
    component.configType = null; // Set to null for initial state
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should set nudge title and body for CipherType.Login type", async () => {
    component.configType = CipherType.Login;
    accountService.activeAccount$ = of({ id: "test-user-id" as UserId } as Account);
    jest.spyOn(component, "checkHasSpotlightDismissed").mockResolvedValue(true);

    await component.ngOnInit();

    expect(component.showNewItemSpotlight).toBe(true);
    expect(component.nudgeTitle).toBe("newLoginNudgeTitle");
    expect(component.nudgeBody).toBe("newLoginNudgeBody");
    expect(component.dismissalNudgeType).toBe(VaultNudgeType.newLoginItemStatus);
  });

  it("should set nudge title and body for CipherType.Card type", async () => {
    component.configType = CipherType.Card;
    accountService.activeAccount$ = of({ id: "test-user-id" as UserId } as Account);
    jest.spyOn(component, "checkHasSpotlightDismissed").mockResolvedValue(true);

    await component.ngOnInit();

    expect(component.showNewItemSpotlight).toBe(true);
    expect(component.nudgeTitle).toBe("newCardNudgeTitle");
    expect(component.nudgeBody).toBe("newCardNudgeBody");
    expect(component.dismissalNudgeType).toBe(VaultNudgeType.newCardItemStatus);
  });

  it("should not show anything if spotlight has been dismissed", async () => {
    component.configType = CipherType.Identity;
    accountService.activeAccount$ = of({ id: "test-user-id" as UserId } as Account);
    jest.spyOn(component, "checkHasSpotlightDismissed").mockResolvedValue(false);

    await component.ngOnInit();

    expect(component.showNewItemSpotlight).toBe(false);
    expect(component.dismissalNudgeType).toBe(VaultNudgeType.newIdentityItemStatus);
  });

  it("should set showNewItemSpotlight to false when user dismisses spotlight", async () => {
    component.showNewItemSpotlight = true;
    component.dismissalNudgeType = VaultNudgeType.newLoginItemStatus;
    component.activeUserId = "test-user-id" as UserId;

    const dismissSpy = jest.spyOn(vaultNudgesService, "dismissNudge").mockResolvedValue();

    await component.dismissNewItemSpotlight();

    expect(component.showNewItemSpotlight).toBe(false);
    expect(dismissSpy).toHaveBeenCalledWith(
      VaultNudgeType.newLoginItemStatus,
      component.activeUserId,
    );
  });
});
