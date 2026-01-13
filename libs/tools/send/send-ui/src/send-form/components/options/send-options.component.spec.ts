import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, ToastService } from "@bitwarden/components";
import { CredentialGeneratorService } from "@bitwarden/generator-core";

import { SendFormContainer } from "../../send-form-container";

import { SendOptionsComponent } from "./send-options.component";

describe("SendOptionsComponent", () => {
  let component: SendOptionsComponent;
  let fixture: ComponentFixture<SendOptionsComponent>;
  const mockSendFormContainer = mock<SendFormContainer>();
  const mockAccountService = mock<AccountService>();

  beforeAll(() => {
    mockAccountService.activeAccount$ = of({ id: "myTestAccount" } as Account);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendOptionsComponent],
      declarations: [],
      providers: [
        { provide: SendFormContainer, useValue: mockSendFormContainer },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: SendApiService, useValue: mock<SendApiService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: CredentialGeneratorService, useValue: mock<CredentialGeneratorService>() },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendOptionsComponent);
    component = fixture.componentInstance;
    component.config = { areSendsAllowed: true, mode: "add", sendType: SendType.Text };
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should emit a null password when password textbox is empty", async () => {
    const newSend = {} as SendView;
    mockSendFormContainer.patchSend.mockImplementation((updateFn) => updateFn(newSend));
    component.sendOptionsForm.patchValue({ password: "testing" });
    expect(newSend.password).toBe("testing");
    component.sendOptionsForm.patchValue({ password: "" });
    expect(newSend.password).toBe(null);
  });
});
