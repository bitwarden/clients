import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ProgressModule,
  CardComponent,
  TypographyModule,
  ButtonModule,
} from "@bitwarden/components";

@Component({
  selector: "app-storage-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CardComponent,
    TypographyModule,
    ButtonModule,
    ProgressModule,
    JslibModule,
  ],
  templateUrl: "./storage-card.component.html",
})
export class StorageCardComponent {
  readonly maxStorageGb = input<number>();
  readonly storageName = input<string>();
  readonly storagePercentage = input<number>();
  readonly showActions = input<boolean>(true);
  readonly isSubscriptionCancelled = input<boolean>(false);

  readonly addStorage = output<void>();
  readonly removeStorage = output<void>();

  onAddStorage() {
    this.addStorage.emit();
  }

  onRemoveStorage() {
    this.removeStorage.emit();
  }
}
