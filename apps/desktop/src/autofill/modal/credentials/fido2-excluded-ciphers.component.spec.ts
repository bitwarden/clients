import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DesktopSettingsService } from "../../../platform/services/desktop-settings.service";
import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../services/desktop-fido2-user-interface.service";

import { Fido2ExcludedCiphersComponent } from "./fido2-excluded-ciphers.component";

describe("Fido2ExcludedCiphersComponent", () => {
  let component: Fido2ExcludedCiphersComponent;
  let fixture: ComponentFixture<Fido2ExcludedCiphersComponent>;
  let mockDesktopSettingsService: MockProxy<DesktopSettingsService>;
  let mockFido2UserInterfaceService: MockProxy<DesktopFido2UserInterfaceService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockRouter: MockProxy<Router>;
  let mockSession: MockProxy<DesktopFido2UserInterfaceSession>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    mockDesktopSettingsService = mock<DesktopSettingsService>();
    mockFido2UserInterfaceService = mock<DesktopFido2UserInterfaceService>();
    mockAccountService = mock<AccountService>();
    mockRouter = mock<Router>();
    mockSession = mock<DesktopFido2UserInterfaceSession>();
    mockI18nService = mock<I18nService>();

    mockFido2UserInterfaceService.getCurrentSession.mockReturnValue(mockSession);

    await TestBed.configureTestingModule({
      imports: [Fido2ExcludedCiphersComponent],
      providers: [
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: DesktopFido2UserInterfaceService, useValue: mockFido2UserInterfaceService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Fido2ExcludedCiphersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("ngOnInit", () => {
    it("should initialize session", async () => {
      await component.ngOnInit();

      expect(mockFido2UserInterfaceService.getCurrentSession).toHaveBeenCalled();
      expect(component.session).toBe(mockSession);
    });
  });

  describe("closeModal", () => {
    it("should close modal and notify session when session exists", async () => {
      component.session = mockSession;

      await component.closeModal();

      expect(mockDesktopSettingsService.setModalMode).toHaveBeenCalledWith(false);
      expect(mockAccountService.setShowHeader).toHaveBeenCalledWith(true);
      expect(mockSession.notifyConfirmCreateCredential).toHaveBeenCalledWith(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });
  });
});
