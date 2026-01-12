import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CardComponent,
  ProgressModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { Storage } from "../../types/storage";

export type StorageCardAction = "add-storage" | "remove-storage";

@Component({
  selector: "billing-storage-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./storage-card.component.html",
  imports: [CommonModule, ButtonModule, CardComponent, ProgressModule, TypographyModule, I18nPipe],
})
export class StorageCardComponent {
  private i18nService = inject(I18nService);

  readonly storage = input.required<Storage>();

  readonly callsToActionDisabled = input<boolean>(false);

  readonly callToActionClicked = output<StorageCardAction>();

  readonly isEmpty = computed<boolean>(() => this.storage().used === 0);

  readonly isFull = computed<boolean>(() => {
    const storage = this.storage();
    return storage.used >= storage.available;
  });

  readonly percentageUsed = computed<number>(() => {
    const storage = this.storage();
    if (storage.available === 0) {
      return 0;
    }
    return Math.min((storage.used / storage.available) * 100, 100);
  });

  readonly title = computed<string>(() => {
    return this.isFull() ? this.i18nService.t("storageFull") : this.i18nService.t("storage");
  });

  readonly description = computed<string>(() => {
    const storage = this.storage();
    const available = storage.available;
    const readableUsed = storage.readableUsed;

    if (this.isFull()) {
      return this.i18nService.t("storageFullDescription", available.toString());
    }

    return this.i18nService.t("storageUsedDescription", readableUsed, available.toString());
  });

  readonly progressBarColor = computed<"danger" | "primary">(() => {
    return this.isFull() ? "danger" : "primary";
  });

  readonly canRemoveStorage = computed<boolean>(() => !this.isFull());
}
