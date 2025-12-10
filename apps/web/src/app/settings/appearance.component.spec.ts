import { ComponentFixture, fakeAsync, flush, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { AppearanceComponent } from "./appearance.component";

describe("AppearanceComponent", () => {
  let component: AppearanceComponent;
  let fixture: ComponentFixture<AppearanceComponent>;
  let mockI18nService: MockProxy<I18nService>;
  let mockThemeStateService: MockProxy<ThemeStateService>;
  let mockDomainSettingsService: MockProxy<DomainSettingsService>;

  const mockShowFavicons$ = new BehaviorSubject<boolean>(true);
  const mockSelectedTheme$ = new BehaviorSubject<Theme>(ThemeTypes.Light);
  const mockUserSetLocale$ = new BehaviorSubject<string | undefined>("en");

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

    mockI18nService.supportedTranslationLocales = mockSupportedLocales;
    mockI18nService.localeNames = mockLocaleNames;
    mockI18nService.collator = {
      compare: jest.fn((a: string, b: string) => a.localeCompare(b)),
    } as any;
    mockI18nService.t.mockImplementation((key: string) => `${key}-used-i18n`);
    mockI18nService.userSetLocale$ = mockUserSetLocale$;

    mockThemeStateService.selectedTheme$ = mockSelectedTheme$;
    mockDomainSettingsService.showFavicons$ = mockShowFavicons$;

    mockDomainSettingsService.setShowFavicons.mockResolvedValue(undefined);
    mockThemeStateService.setSelectedTheme.mockResolvedValue(undefined);
    mockI18nService.setLocale.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [AppearanceComponent, ReactiveFormsModule, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ThemeStateService, useValue: mockThemeStateService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
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
