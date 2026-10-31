import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { LogService, Measurement, PerfTrackGroup } from "@bitwarden/logging";

import { IconComponent } from "./icon.component";

const ICONS_URL = "https://icons.example";

describe("IconComponent", () => {
  let fixture: ComponentFixture<IconComponent>;
  let logService: MockProxy<LogService>;
  let measurement: MockProxy<Measurement>;
  let showFavicons$: BehaviorSubject<boolean>;

  const login = (uri: string) => {
    const cipher = new CipherView();
    cipher.type = CipherType.Login;
    cipher.login = new LoginView();
    cipher.login.uris = [Object.assign(new LoginUriView(), { uri })];
    return cipher;
  };

  const render = async (cipher: CipherView) => {
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const img = () => fixture.debugElement.query(By.css("img"));

  beforeEach(async () => {
    measurement = mock<Measurement>();
    logService = mock<LogService>();
    logService.startMeasurement.mockReturnValue(measurement);
    showFavicons$ = new BehaviorSubject(true);

    await TestBed.configureTestingModule({
      imports: [IconComponent],
      providers: [
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => ICONS_URL }) },
        },
        {
          provide: DomainSettingsService,
          useValue: { showFavicons$ },
        },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => of(false) },
        },
        { provide: LogService, useValue: logService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    await render(login("https://a.example"));
  });

  it("starts an icon entry on the Vault track group when the image is bound", () => {
    expect(img().attributes["src"]).toBe(`${ICONS_URL}/a.example/icon.png`);
    expect(logService.startMeasurement).toHaveBeenCalledWith(
      PerfTrackGroup.Vault,
      "Icons",
      "Load icon",
    );
  });

  it("finishes the entry once the image loads", () => {
    img().triggerEventHandler("load");

    expect(measurement.finish).toHaveBeenCalledTimes(1);
    expect(measurement.finish).toHaveBeenCalledWith([["Result", "loaded"]]);
  });

  it("finishes the entry when the image fails", () => {
    img().triggerEventHandler("error");

    expect(measurement.finish).toHaveBeenCalledWith([["Result", "error"]]);
  });

  it("records one entry per load", () => {
    img().triggerEventHandler("load");
    img().triggerEventHandler("load");

    expect(measurement.finish).toHaveBeenCalledTimes(1);
  });

  it("starts a new entry when the image changes", async () => {
    await render(login("https://b.example"));

    expect(logService.startMeasurement).toHaveBeenCalledTimes(2);
  });

  it("records nothing when favicons are off", async () => {
    logService.startMeasurement.mockClear();

    showFavicons$.next(false);
    await render(login("https://a.example"));

    expect(img()).toBeNull();
    expect(logService.startMeasurement).not.toHaveBeenCalled();
  });
});
