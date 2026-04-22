import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendPolicyService } from "@bitwarden/send-ui";

import { SendFormService } from "../../abstractions/send-form.service";
import { SendFormContainer } from "../../send-form-container";

import { SendOptionsComponent } from "./send-options.component";

describe("SendOptionsComponent", () => {
  let component: SendOptionsComponent;
  let fixture: ComponentFixture<SendOptionsComponent>;
  const mockSendFormContainer = mock<SendFormContainer>();
  const mockAccountService = mock<AccountService>();
  const mockSendFormService = mock<SendFormService>();

  beforeAll(() => {
    mockAccountService.activeAccount$ = of({ id: "myTestAccount" } as Account);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendOptionsComponent],
      declarations: [],
      providers: [
        { provide: SendFormContainer, useValue: mockSendFormContainer },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SendFormService, useValue: mockSendFormService },
        { provide: SendPolicyService, useValue: { disableHideEmail$: of(false) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendOptionsComponent);
    component = fixture.componentInstance;
    mockSendFormService.sendFormConfig = {
      areSendsAllowed: true,
      mode: "add",
      sendType: SendType.Text,
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
