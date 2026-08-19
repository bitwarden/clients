// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  CardComponent,
  CardContentComponent,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SegmentedCardComponent,
  TypographyModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-item-history-v2",
  templateUrl: "item-history-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    CardComponent,
    CardContentComponent,
    SectionComponent,
    SectionHeaderComponent,
    SegmentedCardComponent,
    TypographyModule,
    ButtonModule,
    LinkModule,
  ],
})
export class ItemHistoryV2Component {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipher: CipherView;

  protected readonly vfo1Foundation = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  constructor(
    private viewPasswordHistoryService: ViewPasswordHistoryService,
    private configService: ConfigService,
  ) {}

  get isLogin() {
    return this.cipher.type === CipherType.Login;
  }

  protected get historyRows(): { labelKey: string; date: Date | null | undefined }[] {
    const rows: { labelKey: string; date: Date | null | undefined }[] = [
      { labelKey: "lastEdited", date: this.cipher.revisionDate },
      { labelKey: "dateCreated", date: this.cipher.creationDate },
    ];
    if (this.cipher.passwordRevisionDisplayDate) {
      rows.push({ labelKey: "datePasswordUpdated", date: this.cipher.passwordRevisionDisplayDate });
    }
    return rows;
  }

  /**
   * View the password history for the cipher.
   */
  async viewPasswordHistory() {
    await this.viewPasswordHistoryService.viewPasswordHistory(this.cipher);
  }
}
