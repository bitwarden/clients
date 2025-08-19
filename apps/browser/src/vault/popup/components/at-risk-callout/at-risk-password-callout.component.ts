import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { AnchorLinkDirective, CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "vault-at-risk-password-callout",
  imports: [CommonModule, AnchorLinkDirective, RouterModule, CalloutModule, I18nPipe],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private taskService = inject(TaskService);
  private cipherService = inject(CipherService);
  private activeAccount$ = inject(AccountService).activeAccount$.pipe(getUserId);

  protected pendingTasks$ = this.activeAccount$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.taskService.pendingTasks$(userId),
        this.cipherService.cipherViews$(userId),
      ]),
    ),
    map(([tasks, ciphers]) =>
      tasks.filter((t) => {
        const associatedCipher = ciphers.find((c) => c.id === t.cipherId);

        return (
          t.type === SecurityTaskType.UpdateAtRiskCredential &&
          associatedCipher &&
          !associatedCipher.isDeleted
        );
      }),
    ),
  );
}
