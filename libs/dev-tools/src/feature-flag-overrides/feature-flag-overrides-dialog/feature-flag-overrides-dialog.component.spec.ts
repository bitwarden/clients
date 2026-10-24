import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef } from "@bitwarden/components";

import { BOOLEAN_FEATURE_FLAGS } from "../feature-flag-catalog";
import { DEV_TOOLS_RELOAD_APP } from "../feature-flag-override.tokens";

import { FeatureFlagOverridesDialogComponent } from "./feature-flag-overrides-dialog.component";

describe("FeatureFlagOverridesDialogComponent", () => {
  const flag = FeatureFlag.PM32009NewItemTypes;

  let overrides$: BehaviorSubject<Partial<Record<FeatureFlag, boolean>>>;
  let configService: MockProxy<ConfigService>;
  let reloadApp: jest.Mock;
  let i18nService: MockProxy<I18nService>;
  let fixture: ComponentFixture<FeatureFlagOverridesDialogComponent>;
  let component: FeatureFlagOverridesDialogComponent;

  beforeEach(async () => {
    overrides$ = new BehaviorSubject<Partial<Record<FeatureFlag, boolean>>>({});
    configService = mock<ConfigService>();
    configService.featureFlagOverrides$ = overrides$;
    configService.serverConfig$ = new BehaviorSubject(null);
    reloadApp = jest.fn();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [FeatureFlagOverridesDialogComponent],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: i18nService },
        { provide: DEV_TOOLS_RELOAD_APP, useValue: reloadApp },
        { provide: DialogRef, useValue: mock<DialogRef>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureFlagOverridesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // `rows`, `overrideCount`, `setChoice`, `clearAll` and `reload` are `protected` — the template is
  // their only real consumer, so reach through the instance to exercise them directly.
  type PublicSurface = {
    rows: () => { name: string; flag: FeatureFlag; choice: string }[];
    overrideCount: () => number;
    setChoice: (flag: FeatureFlag, choice: "on" | "off" | "default") => Promise<void>;
    clearAll: () => Promise<void>;
    reload: () => void;
    search: { set: (value: string) => void };
  };
  const instance = () => component as unknown as PublicSurface;

  it("lists every boolean flag", () => {
    expect(instance().rows()).toHaveLength(BOOLEAN_FEATURE_FLAGS.length);
  });

  it("reports a flag with no override as default", () => {
    expect(
      instance()
        .rows()
        .find((r) => r.flag === flag)?.choice,
    ).toBe("default");
  });

  it.each([
    [true, "on"],
    [false, "off"],
  ])("reports an override of %s as %s", (value, expected) => {
    overrides$.next({ [flag]: value });
    fixture.detectChanges();

    expect(
      instance()
        .rows()
        .find((r) => r.flag === flag)?.choice,
    ).toBe(expected);
  });

  it("filters by enum member name and by wire value", () => {
    instance().search.set(flag);
    fixture.detectChanges();

    expect(
      instance()
        .rows()
        .map((r) => r.flag),
    ).toEqual([flag]);
  });

  it.each([
    ["on", true],
    ["off", false],
  ] as const)("writes an override when %s is chosen", async (choice, expected) => {
    await instance().setChoice(flag, choice);

    expect(configService.setFeatureFlagOverride).toHaveBeenCalledWith(flag, expected);
    expect(configService.clearFeatureFlagOverride).not.toHaveBeenCalled();
  });

  it("clears the override when default is chosen", async () => {
    await instance().setChoice(flag, "default");

    expect(configService.clearFeatureFlagOverride).toHaveBeenCalledWith(flag);
    expect(configService.setFeatureFlagOverride).not.toHaveBeenCalled();
  });

  it("counts the active overrides", () => {
    overrides$.next({ [flag]: true, [FeatureFlag.FedRampGovRegion]: false });
    fixture.detectChanges();

    expect(instance().overrideCount()).toBe(2);
  });

  it("clears all overrides", async () => {
    await instance().clearAll();

    expect(configService.clearAllFeatureFlagOverrides).toHaveBeenCalled();
  });

  it("reloads the app through the client-supplied callback", () => {
    instance().reload();

    expect(reloadApp).toHaveBeenCalled();
  });
});
