import { DatePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";
import { PasswordRepromptService } from "../../services/password-reprompt.service";

import { DriversLicenseViewComponent } from "./drivers-license-view.component";

describe("DriversLicenseViewComponent", () => {
  let component: DriversLicenseViewComponent;
  let fixture: ComponentFixture<DriversLicenseViewComponent>;

  const collect = jest.fn();

  const cipher = new CipherView();
  cipher.id = "cipher-id";
  cipher.organizationId = null;

  const driversLicense = new DriversLicenseView();
  driversLicense.licenseNumber = "DL123456";

  beforeEach(async () => {
    collect.mockClear();

    await TestBed.configureTestingModule({
      imports: [DriversLicenseViewComponent],
      providers: [
        DatePipe,
        { provide: EventCollectionService, useValue: mock<EventCollectionService>({ collect }) },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DriversLicenseViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("driversLicense", driversLicense);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
  });

  describe("formatDate", () => {
    it("returns empty string for undefined", () => {
      expect(component.formatDate(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(component.formatDate("")).toBe("");
    });

    it("formats a full date as longDate", () => {
      expect(component.formatDate("2024-01-15")).toBe("January 15, 2024");
    });

    it("returns the date string when only year is present", () => {
      expect(component.formatDate("2024")).toBe("2024");
    });

    it("formats december correctly", () => {
      expect(component.formatDate("1990-12-31")).toBe("December 31, 1990");
    });
  });

  describe("toggleLicenseNumberVisible", () => {
    it("sets revealLicenseNumber to true and collects event when made visible", async () => {
      await component.toggleLicenseNumberVisible(true);

      expect(component.revealLicenseNumber()).toBe(true);
      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientToggledLicenseNumberVisible,
        cipher.id,
        false,
        cipher.organizationId,
      );
    });

    it("sets revealLicenseNumber to false without collecting event", async () => {
      await component.toggleLicenseNumberVisible(false);

      expect(component.revealLicenseNumber()).toBe(false);
      expect(collect).not.toHaveBeenCalled();
    });
  });
});
