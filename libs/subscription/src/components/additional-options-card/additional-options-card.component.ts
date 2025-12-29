import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CardComponent, TypographyModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-additional-options-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardComponent, TypographyModule, ButtonModule, JslibModule],
  templateUrl: "./additional-options-card.component.html",
})
export class AdditionalOptionsCardComponent {
  readonly showDownloadLicense = input<boolean>(true);
  readonly showCancelSubscription = input<boolean>(true);
  readonly cancelPromise = input<Promise<any> | null>(null);

  readonly downloadLicense = output<void>();
  readonly cancelSubscription = output<void>();

  onDownloadLicense() {
    this.downloadLicense.emit();
  }

  onCancelSubscription() {
    this.cancelSubscription.emit();
  }
}
