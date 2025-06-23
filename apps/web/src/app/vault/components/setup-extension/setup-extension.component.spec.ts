import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SetupExtensionComponent } from "./setup-extension.component";

describe("SetupExtensionComponent", () => {
  let fixture: ComponentFixture<SetupExtensionComponent>;
  let component: SetupExtensionComponent;

  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const navigate = jest.fn().mockResolvedValue(true);

  beforeEach(async () => {
    navigate.mockClear();
    getFeatureFlag.mockClear().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupExtensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("initially shows the loading spinner", () => {
    const spinner = fixture.debugElement.query(By.css("i"));

    expect(spinner.nativeElement.title).toBe("loading");
  });

  describe("initialization", () => {
    it("redirects to the vault if the feature flag is disabled", async () => {
      Utils.isMobileBrowser = false;
      getFeatureFlag.mockResolvedValue(false);
      navigate.mockClear();

      await component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("redirects to the vault if the user is on a mobile browser", async () => {
      Utils.isMobileBrowser = true;
      getFeatureFlag.mockResolvedValue(true);
      navigate.mockClear();

      await component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("does not redirect the user", async () => {
      Utils.isMobileBrowser = false;
      getFeatureFlag.mockResolvedValue(true);
      navigate.mockClear();

      await component.ngOnInit();

      expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM19315EndUserActivationMvp);
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
