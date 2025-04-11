import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { AnchorLinkDirective, CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "vault-at-risk-password-callout",
  standalone: true,
  imports: [CommonModule, AnchorLinkDirective, RouterModule, CalloutModule, I18nPipe],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private taskService = inject(TaskService);
  private activeAccount$ = inject(AccountService).activeAccount$.pipe(getUserId);

  protected pendingTasks$ = this.activeAccount$.pipe(
    switchMap((userId) =>
      this.taskService.tasksEnabled$(userId).pipe(
        switchMap((enabled) => {
          if (!enabled) {
            return of([]);
          }
          return this.taskService
            .pendingTasks$(userId)
            .pipe(
              map((tasks) =>
                tasks.filter((t) => t.type === SecurityTaskType.UpdateAtRiskCredential),
              ),
            );
        }),
      ),
    ),
  );
}
