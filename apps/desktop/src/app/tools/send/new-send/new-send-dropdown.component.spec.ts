import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { ButtonModule, MenuModule, BadgeModule } from "@bitwarden/components";

import { NewSendDropdownComponent } from "./new-send-dropdown.component";

describe("NewSendDropdownComponent", () => {
  let component: NewSendDropdownComponent;
  let fixture: ComponentFixture<NewSendDropdownComponent>;
  let accountServiceMock: any;
  let billingAccountProfileStateServiceMock: any;
  let messagingServiceMock: any;

  beforeEach(async () => {
    accountServiceMock = {
      activeAccount$: of({ id: "test-account-id" }),
    };

    billingAccountProfileStateServiceMock = {
      hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(true)),
    };

    messagingServiceMock = {
      send: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, JslibModule, ButtonModule, MenuModule, BadgeModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: accountServiceMock },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateServiceMock,
        },
        { provide: MessagingService, useValue: messagingServiceMock },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewSendDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should emit onCreateSendOfType when createSend is called with a valid type", async () => {
    const sendType = SendType.Text;
    jest.spyOn(component.onCreateSendOfType, "emit");

    await component.createSend(sendType);

    expect(component.onCreateSendOfType.emit).toHaveBeenCalledWith(sendType);
  });

  it("should call messagingService.send when createSend is called with SendType.File and no premium access", async () => {
    billingAccountProfileStateServiceMock.hasPremiumFromAnySource$.mockReturnValue(of(false));

    await component.createSend(SendType.File);

    expect(messagingServiceMock.send).toHaveBeenCalledWith("openPremium");
  });

  it("should not call messagingService.send when createSend is called with SendType.File and has premium access", async () => {
    const sendType = SendType.File;
    jest.spyOn(component.onCreateSendOfType, "emit");
    billingAccountProfileStateServiceMock.hasPremiumFromAnySource$.mockReturnValue(of(true));

    await component.createSend(sendType);

    expect(messagingServiceMock.send).not.toHaveBeenCalled();
    expect(component.onCreateSendOfType.emit).toHaveBeenCalledWith(sendType);
  });
});
