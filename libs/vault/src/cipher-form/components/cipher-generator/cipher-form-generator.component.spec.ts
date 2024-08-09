import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  PasswordGenerationServiceAbstraction,
  PasswordGeneratorOptions,
  UsernameGenerationServiceAbstraction,
  UsernameGeneratorOptions,
} from "@bitwarden/generator-legacy";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

describe("CipherFormGeneratorComponent", () => {
  let component: CipherFormGeneratorComponent;
  let fixture: ComponentFixture<CipherFormGeneratorComponent>;

  let mockLegacyPasswordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let mockLegacyUsernameGenerationService: MockProxy<UsernameGenerationServiceAbstraction>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;

  let passwordOptions$: BehaviorSubject<any>;
  let usernameOptions$: BehaviorSubject<any>;

  beforeEach(async () => {
    passwordOptions$ = new BehaviorSubject([
      {
        type: "password",
      },
    ] as [PasswordGeneratorOptions]);
    usernameOptions$ = new BehaviorSubject([
      {
        type: "word",
      },
    ] as [UsernameGeneratorOptions]);

    mockPlatformUtilsService = mock<PlatformUtilsService>();

    mockLegacyPasswordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    mockLegacyPasswordGenerationService.getOptions$.mockReturnValue(passwordOptions$);

    mockLegacyUsernameGenerationService = mock<UsernameGenerationServiceAbstraction>();
    mockLegacyUsernameGenerationService.getOptions$.mockReturnValue(usernameOptions$);

    await TestBed.configureTestingModule({
      imports: [CipherFormGeneratorComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: PasswordGenerationServiceAbstraction,
          useValue: mockLegacyPasswordGenerationService,
        },
        {
          provide: UsernameGenerationServiceAbstraction,
          useValue: mockLegacyUsernameGenerationService,
        },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CipherFormGeneratorComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("should use the appropriate text based on generator type", () => {
    component.type = "password";
    component.ngOnChanges();
    expect(component["regenerateButtonTitle"]).toBe("regeneratePassword");

    component.type = "username";
    component.ngOnChanges();
    expect(component["regenerateButtonTitle"]).toBe("regenerateUsername");
  });

  it("should emit regenerate$ when user clicks the regenerate button", fakeAsync(() => {
    const regenerateSpy = jest.spyOn(component["regenerate$"], "next");

    fixture.nativeElement.querySelector("button[data-testid='regenerate-button']").click();

    expect(regenerateSpy).toHaveBeenCalled();
  }));

  it("should emit valueGenerated whenever a new value is generated", fakeAsync(() => {
    const valueGeneratedSpy = jest.spyOn(component.valueGenerated, "emit");

    mockLegacyPasswordGenerationService.generatePassword.mockResolvedValue("generated-password");
    component.type = "password";

    component.ngOnChanges();
    tick();

    expect(valueGeneratedSpy).toHaveBeenCalledWith("generated-password");
  }));

  describe("password generation", () => {
    beforeEach(() => {
      component.type = "password";
    });

    it("should update the generated value when the password options change", fakeAsync(() => {
      mockLegacyPasswordGenerationService.generatePassword
        .mockResolvedValueOnce("first-password")
        .mockResolvedValueOnce("second-password");

      component.ngOnChanges();
      tick();

      expect(component["generatedValue"]).toBe("first-password");

      passwordOptions$.next([{ type: "password" }]);
      tick();

      expect(component["generatedValue"]).toBe("second-password");
      expect(mockLegacyPasswordGenerationService.generatePassword).toHaveBeenCalledTimes(2);
    }));

    it("should show password type toggle when the generator type is password", () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-toggle-group")).toBeTruthy();
    });

    it("should save password options when the password type is updated", async () => {
      mockLegacyPasswordGenerationService.generatePassword.mockResolvedValue("generated-password");

      await component["updatePasswordType"]("passphrase");

      expect(mockLegacyPasswordGenerationService.saveOptions).toHaveBeenCalledWith({
        type: "passphrase",
      });
    });

    it("should update the password history when a new password is generated", fakeAsync(() => {
      mockLegacyPasswordGenerationService.generatePassword.mockResolvedValue("new-password");

      component.ngOnChanges();
      tick();

      expect(mockLegacyPasswordGenerationService.generatePassword).toHaveBeenCalledTimes(1);
      expect(mockLegacyPasswordGenerationService.addHistory).toHaveBeenCalledWith("new-password");
      expect(component["generatedValue"]).toBe("new-password");
    }));

    it("should regenerate the password when regenerate$ emits", fakeAsync(() => {
      mockLegacyPasswordGenerationService.generatePassword
        .mockResolvedValueOnce("first-password")
        .mockResolvedValueOnce("second-password");

      component.ngOnChanges();
      tick();

      expect(component["generatedValue"]).toBe("first-password");

      component["regenerate$"].next();
      tick();

      expect(component["generatedValue"]).toBe("second-password");
    }));
  });

  describe("username generation", () => {
    beforeEach(() => {
      component.type = "username";
    });

    it("should update the generated value when the username options change", fakeAsync(() => {
      mockLegacyUsernameGenerationService.generateUsername
        .mockResolvedValueOnce("first-username")
        .mockResolvedValueOnce("second-username");

      component.ngOnChanges();
      tick();

      expect(component["generatedValue"]).toBe("first-username");

      usernameOptions$.next([{ type: "word" }]);
      tick();

      expect(component["generatedValue"]).toBe("second-username");
    }));

    it("should regenerate the username when regenerate$ emits", fakeAsync(() => {
      mockLegacyUsernameGenerationService.generateUsername
        .mockResolvedValueOnce("first-username")
        .mockResolvedValueOnce("second-username");

      component.ngOnChanges();
      tick();

      expect(component["generatedValue"]).toBe("first-username");

      component["regenerate$"].next();
      tick();

      expect(component["generatedValue"]).toBe("second-username");
    }));

    it("should not show password type toggle when the generator type is username", () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-toggle-group")).toBeNull();
    });
  });
});
