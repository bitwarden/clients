import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingPackagingType,
} from "@bitwarden/common/desktop-native/models/autotype-pairing-data";
import {
  DESKTOP_APP_URI_PREFIX,
  DesktopAutotypePairingUri,
} from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { ToastService } from "@bitwarden/components";

import { AutofillOptionsViewComponent } from "./autofill-options-view.component";

function createPairingUri(name: string): string {
  return new DesktopAutotypePairingUri(DesktopAutotypePairingUri.CurrentVersion, {
    metadata: {
      schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
      pairingTimestamp: 1793577600,
    },
    appData: { name, normalizedPath: `C:\\Program Files\\${name}\\${name}.exe` },
    clientData: { packagingType: AutotypePairingPackagingType.WindowsExe },
  }).toString();
}

describe("AutofillOptionsViewComponent", () => {
  let fixture: ComponentFixture<AutofillOptionsViewComponent>;
  let configService: MockProxy<ConfigService>;
  let gaFeatureFlag$: BehaviorSubject<boolean>;

  const pairingUri = createPairingUri("Notepad");

  const getRows = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("[data-testid='autofill-view-list']"),
    ) as HTMLElement[];

  const getByTestId = (testId: string, parent: HTMLElement = fixture.nativeElement) =>
    parent.querySelector(`[data-testid='${testId}']`) as HTMLInputElement | null;

  function render(uris: string[]) {
    fixture = TestBed.createComponent(AutofillOptionsViewComponent);
    fixture.componentRef.setInput(
      "loginUris",
      uris.map((uri) => Object.assign(new LoginUriView(), { uri, match: UriMatchStrategy.Never })),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    gaFeatureFlag$ = new BehaviorSubject(false);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
      flag === FeatureFlag.WindowsDesktopAutotypeGA ? gaFeatureFlag$ : of(false),
    );

    await TestBed.configureTestingModule({
      imports: [AutofillOptionsViewComponent],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: AccountService, useValue: mock<AccountService>({ activeAccount$: of(null) }) },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
      ],
    }).compileComponents();
  });

  describe("when the windows-desktop-autotype-ga feature flag is on", () => {
    beforeEach(() => {
      gaFeatureFlag$.next(true);
    });

    it("shows a desktop app by the name of the paired desktop app", () => {
      render([pairingUri]);

      expect(getRows()[0].textContent).toContain("desktopApp");
      expect(getByTestId("login-desktop-app").value).toBe("Notepad");
    });

    it("does not show launch or copy buttons for a desktop app", () => {
      render([pairingUri]);

      expect(getByTestId("launch-website")).toBeNull();
      expect(getByTestId("copy-website")).toBeNull();
    });

    it("shows only the desktop app name, never any part of the pairing URI", () => {
      render([pairingUri]);

      const inputValues = Array.from(fixture.nativeElement.querySelectorAll("input")).map(
        (input: HTMLInputElement) => input.value,
      );
      expect(inputValues).toEqual(["Notepad"]);
      expect(fixture.nativeElement.textContent).not.toContain("autotype");
    });

    it("shows a website with its launch and copy buttons", () => {
      render(["https://example.com"]);

      expect(getByTestId("login-website").value).toBe("example.com");
      expect(getByTestId("launch-website")).toBeTruthy();
      expect(getByTestId("copy-website")).toBeTruthy();
    });

    it.each([
      `${DESKTOP_APP_URI_PREFIX}autotype?version=1.0.0&data=invalid`,
      DESKTOP_APP_URI_PREFIX,
    ])(
      "shows a desktop app URI that is not a valid pairing URI as an invalid app pairing (%s)",
      (uri) => {
        render([uri]);

        expect(getRows()[0].textContent).toContain("desktopApp");
        expect(getByTestId("login-desktop-app").value).toBe("invalidAppPairing");
        expect(getByTestId("launch-website")).toBeNull();
        expect(getByTestId("copy-website")).toBeNull();
      },
    );

    it("shows a desktop app URI with an uppercase prefix as a website", () => {
      render([pairingUri.replace(DESKTOP_APP_URI_PREFIX, "DESKTOPAPP://")]);

      expect(getByTestId("login-website")).toBeTruthy();
      expect(getByTestId("login-desktop-app")).toBeNull();
    });

    it("shows websites and desktop apps in their saved order", () => {
      render(["https://example.com", pairingUri]);

      const [first, second] = getRows();
      expect(getByTestId("login-website", first)).toBeTruthy();
      expect(getByTestId("login-desktop-app", second)).toBeTruthy();
    });

    it("keeps showing desktop apps when the feature flag turns off while the view is open", () => {
      render([pairingUri]);

      gaFeatureFlag$.next(false);
      fixture.detectChanges();

      expect(getByTestId("login-desktop-app").value).toBe("Notepad");
    });
  });

  describe("when the windows-desktop-autotype-ga feature flag is off", () => {
    it("shows a desktop app URI as a website", () => {
      render([pairingUri]);

      expect(getByTestId("login-website")).toBeTruthy();
      expect(getByTestId("login-desktop-app")).toBeNull();
    });

    it("keeps showing desktop app URIs as websites when the feature flag turns on while the view is open", () => {
      render([pairingUri]);

      gaFeatureFlag$.next(true);
      fixture.detectChanges();

      expect(getByTestId("login-website")).toBeTruthy();
      expect(getByTestId("login-desktop-app")).toBeNull();
    });
  });

  describe("when the feature flag is read after the view opens", () => {
    let lateGaFeatureFlag$: Subject<boolean>;

    beforeEach(() => {
      lateGaFeatureFlag$ = new Subject<boolean>();
      configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
        flag === FeatureFlag.WindowsDesktopAutotypeGA ? lateGaFeatureFlag$ : of(false),
      );
    });

    it("shows desktop apps once the feature flag is read as on", () => {
      render([pairingUri]);

      lateGaFeatureFlag$.next(true);
      fixture.detectChanges();

      expect(getByTestId("login-desktop-app").value).toBe("Notepad");
    });

    it("keeps showing desktop apps when the feature flag changes after it's read", () => {
      render([pairingUri]);

      lateGaFeatureFlag$.next(true);
      lateGaFeatureFlag$.next(false);
      fixture.detectChanges();

      expect(getByTestId("login-desktop-app").value).toBe("Notepad");
    });
  });
});
