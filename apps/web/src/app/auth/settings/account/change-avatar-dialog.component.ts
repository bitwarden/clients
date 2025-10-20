// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { BehaviorSubject, debounceTime, firstValueFrom, Subject, takeUntil } from "rxjs";

import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { SelectableAvatarComponent } from "./selectable-avatar.component";

type ChangeAvatarDialogData = {
  profile: ProfileResponse;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  templateUrl: "change-avatar-dialog.component.html",
  encapsulation: ViewEncapsulation.None,
  imports: [SharedModule, SelectableAvatarComponent],
})
export class ChangeAvatarDialogComponent implements OnInit, OnDestroy {
  profile: ProfileResponse;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @ViewChild("colorPicker") colorPickerElement: ElementRef<HTMLElement>;

  loading = false;
  defaultColorPalette: NamedAvatarColor[] = [
    { name: "brightBlue", color: "#16cbfc" },
    { name: "green", color: "#94cc4b" },
    { name: "orange", color: "#ffb520" },
    { name: "lavender", color: "#e5beed" },
    { name: "yellow", color: "#fcff41" },
    { name: "indigo", color: "#acbdf7" },
    { name: "teal", color: "#8ecdc5" },
    { name: "salmon", color: "#ffa3a3" },
    { name: "pink", color: "#ffa2d4" },
  ];
  customColorSelected = false;
  currentSelection: string;

  protected customColor$ = new BehaviorSubject<string | null>(null);
  protected customTextColor$ = new BehaviorSubject<string>("#000000");
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) protected data: ChangeAvatarDialogData,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private avatarService: AvatarService,
    private dialogRef: DialogRef,
    private toastService: ToastService,
  ) {
    this.profile = data.profile;
  }

  async ngOnInit() {
    //localize the default colors
    this.defaultColorPalette.forEach((c) => (c.name = this.i18nService.t(c.name)));

    this.customColor$
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe((color: string | null) => {
        if (color == null) {
          return;
        }
        this.customTextColor$.next(Utils.pickTextColorBasedOnBgColor(color));
        this.customColorSelected = true;
        this.currentSelection = color;
      });

    await this.setSelection(await firstValueFrom(this.avatarService.avatarColor$));
  }

  async showCustomPicker() {
    this.customColorSelected = true;
    this.colorPickerElement.nativeElement.click();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setSelection(this.customColor$.value);
  }

  async generateAvatarColor() {
    Utils.stringToColor(this.profile.name.toString());
  }

  submit = async () => {
    if (Utils.validateHexColor(this.currentSelection) || this.currentSelection == null) {
      await this.avatarService.setAvatarColor(this.currentSelection);
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("avatarUpdated"),
      });
    } else {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async setSelection(color: string | null) {
    this.defaultColorPalette.filter((x) => x.selected).forEach((c) => (c.selected = false));

    if (color == null) {
      return;
    }

    color = color.toLowerCase();

    this.customColorSelected = false;
    //Allow for toggle
    if (this.currentSelection === color) {
      this.currentSelection = null;
    } else {
      const selectedColorIndex = this.defaultColorPalette.findIndex((c) => c.color === color);
      if (selectedColorIndex !== -1) {
        this.defaultColorPalette[selectedColorIndex].selected = true;
        this.currentSelection = color;
      } else {
        this.customColor$.next(color);
      }
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<ChangeAvatarDialogData>) {
    return dialogService.open(ChangeAvatarDialogComponent, config);
  }
}

export class NamedAvatarColor {
  name: string;
  color: string;
  selected? = false;
}
