import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherViewComponent } from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-item",
  templateUrl: "send-access-item.component.html",
  imports: [SharedModule, CipherViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      // This is required to make the CipherViewComponent work
      provide: ViewPasswordHistoryService,
      useClass: VaultViewPasswordHistoryService,
    },
    {
      // Event collection requires the user to be logged in, which won't be the case
      // for many/most Send accesses. Instead we replace the methods with no-ops here.
      // TODO: It'd be better if the EventCollectionService could tolerate anonymous callers
      provide: EventCollectionService,
      useValue: { collect: () => {}, collectMany: () => {} },
    },
  ],
})
export class SendAccessItemComponent {
  readonly FieldType = FieldType;

  readonly send = input.required<SendAccessView>();
  readonly cipher = computed(() => this.send().data.data);

  protected readonly CipherType = CipherType;
}
