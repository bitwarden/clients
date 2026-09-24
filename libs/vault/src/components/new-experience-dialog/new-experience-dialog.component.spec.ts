import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import {
  NEW_EXPERIENCE_LEARN_MORE_URL,
  NewExperienceDialogComponent,
  NewExperienceDialogParams,
  NewExperienceDialogResult,
} from "./new-experience-dialog.component";

describe("NewExperienceDialogComponent", () => {
  let fixture: ComponentFixture<NewExperienceDialogComponent>;
  let dialogRef: MockProxy<DialogRef<NewExperienceDialogResult>>;
  let selectedTheme: BehaviorSubject<Theme>;

  const params: NewExperienceDialogParams = {
    lightImgSrc: "light.png",
    darkImgSrc: "dark.png",
  };

  const buildComponent = async () => {
    dialogRef = mock<DialogRef<NewExperienceDialogResult>>();
    // A bare mock reports every property as truthy, which would hide `bit-dialog`'s close button.
    Object.defineProperty(dialogRef, "disableClose", { value: false });
    selectedTheme = new BehaviorSubject<Theme>(ThemeTypes.Light);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    const themeStateService = mock<ThemeStateService>();
    Object.defineProperty(themeStateService, "selectedTheme$", { value: selectedTheme });

    await TestBed.configureTestingModule({
      imports: [NewExperienceDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
        { provide: ThemeStateService, useValue: themeStateService },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: new BehaviorSubject(ThemeTypes.Light) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewExperienceDialogComponent);
    fixture.detectChanges();
  };

  const image = () => fixture.nativeElement.querySelector("img") as HTMLImageElement;
  const exploreButton = () =>
    fixture.nativeElement.querySelector(
      "#new-experience-dialog_button_explore",
    ) as HTMLButtonElement;
  const learnMoreLink = () =>
    fixture.nativeElement.querySelector(
      "#new-experience-dialog_anchor_learn-more",
    ) as HTMLAnchorElement;

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    await buildComponent();
  });

  it("shows the title, description, primary action and learn more link", () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain("newExperienceDialogTitle");
    expect(text).toContain("newExperienceDialogDesc");
    expect(exploreButton().textContent?.trim()).toBe("exploreTheNewVault");
    expect(learnMoreLink().textContent?.trim()).toBe("learnMore");
  });

  it("points the learn more link at the help center in a new tab", () => {
    expect(learnMoreLink().getAttribute("href")).toBe(NEW_EXPERIENCE_LEARN_MORE_URL);
    expect(learnMoreLink().getAttribute("target")).toBe("_blank");
  });

  it("offers a header close button, so the sheet can be dismissed without exploring", () => {
    expect(fixture.nativeElement.querySelector("button[bitIconButton='bwi-close']")).not.toBeNull();
  });

  it("renders the description as secondary text, so the title carries the emphasis", () => {
    const description = fixture.nativeElement.querySelector("p") as HTMLElement;

    expect(description.className).toContain("tw-text-fg-body-subtle");
  });

  it("renders the title ahead of the screenshot, matching the sheet layout", () => {
    const order = fixture.nativeElement.querySelector("bit-dialog").textContent as string;

    expect(order.indexOf("newExperienceDialogTitle")).toBeLessThan(
      order.indexOf("newExperienceDialogDesc"),
    );
  });

  describe("screenshot", () => {
    it("uses the light source under the light theme", () => {
      expect(image().getAttribute("src")).toBe(params.lightImgSrc);
    });

    it("swaps to the dark source under the dark theme", () => {
      selectedTheme.next(ThemeTypes.Dark);
      fixture.detectChanges();

      expect(image().getAttribute("src")).toBe(params.darkImgSrc);
    });

    it("labels the screenshot for screen readers", () => {
      expect(image().getAttribute("alt")).toBe("newExperienceDialogImgAlt");
    });
  });

  it("closes with the explore result", () => {
    exploreButton().click();

    expect(dialogRef.close).toHaveBeenCalledWith(NewExperienceDialogResult.Explore);
  });

  describe("open", () => {
    /** Opens against a dialog service whose dialog closes with `closedWith`. */
    const openWith = (closedWith: NewExperienceDialogResult | undefined) => {
      const dialogService = mock<DialogService>();
      dialogService.open.mockReturnValue({ closed: of(closedWith) } as never);

      return {
        dialogService,
        result: NewExperienceDialogComponent.open(dialogService, params),
      };
    };

    it("leaves the position strategy unset so the dialog renders as a bottom sheet in the popup", async () => {
      const { dialogService, result } = openWith(NewExperienceDialogResult.Explore);
      await result;

      expect(dialogService.open).toHaveBeenCalledWith(NewExperienceDialogComponent, {
        data: params,
      });
    });

    it("reports a close carrying no result as dismissed", async () => {
      const { result } = openWith(undefined);

      await expect(result).resolves.toBe(NewExperienceDialogResult.Dismissed);
    });

    it("passes the explore result through", async () => {
      const { result } = openWith(NewExperienceDialogResult.Explore);

      await expect(result).resolves.toBe(NewExperienceDialogResult.Explore);
    });
  });
});
