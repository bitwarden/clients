import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { EarlyAccessService } from "@bitwarden/common/platform/services/early-access/early-access.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { AppearanceComponent } from "./appearance.component";

describe("AppearanceComponent", () => {
  let component: AppearanceComponent;
  let fixture: ComponentFixture<AppearanceComponent>;
  let mockI18nService: MockProxy<I18nService>;
  let mockThemeStateService: MockProxy<ThemeStateService>;
  let mockDomainSettingsService: MockProxy<DomainSettingsService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockEarlyAccessService: MockProxy<EarlyAccessService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockLogService: MockProxy<LogService>;
  let mockValidationService: MockProxy<ValidationService>;
  let mockAccountService: MockProxy<AccountService>;

  const mockUserId = "test-user" as UserId;

  const mockShowFavicons$ = new BehaviorSubject<boolean>(true);
  const mockSelectedTheme$ = new BehaviorSubject<Theme>(ThemeTypes.Light);
  const mockUserSetLocale$ = new BehaviorSubject<string | undefined>("en");
  const mockEarlyAccess$ = new BehaviorSubject<boolean>(false);

  const mockSupportedLocales = ["en", "es", "fr", "de"];
  const mockLocaleNames = new Map([
    ["en", "English"],
    ["es", "Español"],
    ["fr", "Français"],
    ["de", "Deutsch"],
  ]);

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockThemeStateService = mock<ThemeStateService>();
    mockDomainSettingsService = mock<DomainSettingsService>();
    mockConfigService = mock<ConfigService>();
    mockEarlyAccessService = mock<EarlyAccessService>();
    mockDialogService = mock<DialogService>();
    mockLogService = mock<LogService>();
    mockValidationService = mock<ValidationService>();
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = of({ id: mockUserId } as any);

    mockI18nService.supportedTranslationLocales = mockSupportedLocales;
    mockI18nService.localeNames = mockLocaleNames;
    mockI18nService.collator = {
      compare: jest.fn((a: string, b: string) => a.localeCompare(b)),
    } as any;
    mockI18nService.t.mockImplementation((key: string) => `${key}-used-i18n`);
    mockI18nService.userSetLocale$ = mockUserSetLocale$;

    mockThemeStateService.selectedTheme$ = mockSelectedTheme$;
    mockDomainSettingsService.showFavicons$ = mockShowFavicons$;
    mockEarlyAccessService.earlyAccess$.mockReturnValue(mockEarlyAccess$);
    mockEarlyAccessService.setEarlyAccess.mockResolvedValue(undefined);
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockDomainSettingsService.setShowFavicons.mockResolvedValue(undefined);
    mockThemeStateService.setSelectedTheme.mockResolvedValue(undefined);
    mockI18nService.setLocale.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [AppearanceComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ThemeStateService, useValue: mockThemeStateService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EarlyAccessService, useValue: mockEarlyAccessService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: LogService, useValue: mockLogService },
        { provide: ValidationService, useValue: mockValidationService },
      ],
    })
      .overrideComponent(AppearanceComponent, {
        set: {
          template: "",
          imports: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppearanceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("constructor", () => {
    describe("locale options setup", () => {
      it("should create locale options sorted by name from supported locales with display names", () => {
        expect(component.localeOptions).toHaveLength(5);
        expect(component.localeOptions[0]).toEqual({ name: "default-used-i18n", value: null });
        expect(component.localeOptions[1]).toEqual({ name: "de - Deutsch", value: "de" });
        expect(component.localeOptions[2]).toEqual({ name: "en - English", value: "en" });
        expect(component.localeOptions[3]).toEqual({ name: "es - Español", value: "es" });
        expect(component.localeOptions[4]).toEqual({ name: "fr - Français", value: "fr" });
      });
    });

    describe("theme options setup", () => {
      it("should create theme options with Light, Dark, and System", () => {
        expect(component.themeOptions).toEqual([
          { name: "themeLight-used-i18n", value: ThemeTypes.Light },
          { name: "themeDark-used-i18n", value: ThemeTypes.Dark },
          { name: "themeSystem-used-i18n", value: ThemeTypes.System },
        ]);
      });
    });
  });

  describe("ngOnInit", () => {
    it("should initialize form with values", fakeAsync(() => {
      mockShowFavicons$.next(false);
      mockSelectedTheme$.next(ThemeTypes.Dark);
      mockUserSetLocale$.next("es");

      fixture.detectChanges();
      flush();

      expect(component.form.value).toEqual({
        enableFavicons: false,
        theme: ThemeTypes.Dark,
        locale: "es",
        earlyAccess: false,
      });
    }));

    it("should set locale to null when user locale not set", fakeAsync(() => {
      mockUserSetLocale$.next(undefined);

      fixture.detectChanges();
      flush();

      expect(component.form.value.locale).toBeNull();
    }));
  });

  describe("enableFavicons value changes", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
      jest.clearAllMocks();
    }));

    it("should call setShowFavicons when enableFavicons changes to true", fakeAsync(() => {
      component.form.controls.enableFavicons.setValue(true);
      flush();

      expect(mockDomainSettingsService.setShowFavicons).toHaveBeenCalledWith(true);
    }));

    it("should call setShowFavicons when enableFavicons changes to false", fakeAsync(() => {
      component.form.controls.enableFavicons.setValue(false);
      flush();

      expect(mockDomainSettingsService.setShowFavicons).toHaveBeenCalledWith(false);
    }));

    it("should not call setShowFavicons when value is null", fakeAsync(() => {
      component.form.controls.enableFavicons.setValue(null);
      flush();

      expect(mockDomainSettingsService.setShowFavicons).not.toHaveBeenCalled();
    }));
  });

  describe("theme value changes", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
      jest.clearAllMocks();
    }));

    it.each([ThemeTypes.Light, ThemeTypes.Dark, ThemeTypes.System])(
      "should call setSelectedTheme when theme changes to %s",
      fakeAsync((themeType: Theme) => {
        component.form.controls.theme.setValue(themeType);
        flush();

        expect(mockThemeStateService.setSelectedTheme).toHaveBeenCalledWith(themeType);
      }),
    );

    it("should not call setSelectedTheme when value is null", fakeAsync(() => {
      component.form.controls.theme.setValue(null);
      flush();

      expect(mockThemeStateService.setSelectedTheme).not.toHaveBeenCalled();
    }));
  });

  describe("earlyAccess value changes", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      flush();
      jest.clearAllMocks();
    }));

    it("persists straight through when disabling (no confirmation)", fakeAsync(() => {
      component.form.controls.earlyAccess.setValue(false);
      flush();

      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(mockEarlyAccessService.setEarlyAccess).toHaveBeenCalledWith(mockUserId, false);
    }));

    it("confirms then persists when enabling", fakeAsync(() => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      component.form.controls.earlyAccess.setValue(true);
      flush();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning" }),
      );
      expect(mockEarlyAccessService.setEarlyAccess).toHaveBeenCalledWith(mockUserId, true);
    }));

    it("reverts the form control when the confirm dialog is cancelled", fakeAsync(() => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      component.form.controls.earlyAccess.setValue(true);
      flush();

      expect(mockEarlyAccessService.setEarlyAccess).not.toHaveBeenCalled();
      expect(component.form.value.earlyAccess).toBe(false);
    }));

    it("reverts and surfaces the error when setEarlyAccess rejects", fakeAsync(() => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      const error = new Error("write failed");
      mockEarlyAccessService.setEarlyAccess.mockRejectedValueOnce(error);

      component.form.controls.earlyAccess.setValue(true);
      flush();

      expect(component.form.value.earlyAccess).toBe(false);
      expect(mockValidationService.showError).toHaveBeenCalledWith(error);
    }));
  });

  describe("locale value changes", () => {
    let reloadMock: jest.Mock;

    beforeEach(fakeAsync(() => {
      reloadMock = jest.fn();
      Object.defineProperty(window, "location", {
        value: { reload: reloadMock },
        writable: true,
      });

      fixture.detectChanges();
      flush();
      jest.clearAllMocks();
    }));

    it("should call setLocale and reload window when locale changes to english", fakeAsync(() => {
      component.form.controls.locale.setValue("es");
      flush();

      expect(mockI18nService.setLocale).toHaveBeenCalledWith("es");
      expect(reloadMock).toHaveBeenCalled();
    }));

    it("should call setLocale and reload window when locale changes to default", fakeAsync(() => {
      component.form.controls.locale.setValue(null);
      flush();

      expect(mockI18nService.setLocale).toHaveBeenCalledWith(null);
      expect(reloadMock).toHaveBeenCalled();
    }));
  });
});
