import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";

import { NewItemNudgeComponent } from "./new-item-nudge.component";

describe("NewItemNudgeComponent", () => {
  let component: NewItemNudgeComponent;
  let fixture: ComponentFixture<NewItemNudgeComponent>;

  let i18nService: MockProxy<I18nService>;
  let accountService: MockProxy<AccountService>;
  let nudgesService: MockProxy<NudgesService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>({ t: (key: string) => key });
    accountService = mock<AccountService>();
    nudgesService = mock<NudgesService>();

    await TestBed.configureTestingModule({
      imports: [NewItemNudgeComponent, CommonModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: accountService },
        { provide: NudgesService, useValue: nudgesService },
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
    expect(component.nudgeBody).toBe(
      "newLoginNudgeBodyOne <strong>newLoginNudgeBodyBold</strong> newLoginNudgeBodyTwo",
    );
    expect(component.dismissalNudgeType).toBe(NudgeType.NewLoginItemStatus);
  });

  it("should set nudge title and body for CipherType.Card type", async () => {
    component.configType = CipherType.Card;
    accountService.activeAccount$ = of({ id: "test-user-id" as UserId } as Account);
    jest.spyOn(component, "checkHasSpotlightDismissed").mockResolvedValue(true);

    await component.ngOnInit();

    expect(component.showNewItemSpotlight).toBe(true);
    expect(component.nudgeTitle).toBe("newCardNudgeTitle");
    expect(component.nudgeBody).toBe("newCardNudgeBody");
    expect(component.dismissalNudgeType).toBe(NudgeType.NewCardItemStatus);
  });

  it("should not show anything if spotlight has been dismissed", async () => {
    component.configType = CipherType.Identity;
    accountService.activeAccount$ = of({ id: "test-user-id" as UserId } as Account);
    jest.spyOn(component, "checkHasSpotlightDismissed").mockResolvedValue(false);

    await component.ngOnInit();

    expect(component.showNewItemSpotlight).toBe(false);
    expect(component.dismissalNudgeType).toBe(NudgeType.NewIdentityItemStatus);
  });

  it("should set showNewItemSpotlight to false when user dismisses spotlight", async () => {
    component.showNewItemSpotlight = true;
    component.dismissalNudgeType = NudgeType.NewLoginItemStatus;
    component.activeUserId = "test-user-id" as UserId;

    const dismissSpy = jest.spyOn(nudgesService, "dismissNudge").mockResolvedValue();

    await component.dismissNewItemSpotlight();

    expect(component.showNewItemSpotlight).toBe(false);
    expect(dismissSpy).toHaveBeenCalledWith(NudgeType.NewLoginItemStatus, component.activeUserId);
  });
});
