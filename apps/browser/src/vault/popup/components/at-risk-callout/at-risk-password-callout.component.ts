import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AnchorLinkDirective, CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { filterOutNullish, SecurityTaskType, TaskService } from "@bitwarden/vault";

// TODO: This component will need to be reworked to use the new EndUserNotificationService in PM-10609

@Component({
  selector: "vault-at-risk-password-callout",
  standalone: true,
  imports: [CommonModule, AnchorLinkDirective, RouterModule, CalloutModule, I18nPipe],
  templateUrl: "./at-risk-password-callout.component.html",
})
export class AtRiskPasswordCalloutComponent {
  private taskService = inject(TaskService);
  private activeAccount$ = inject(AccountService).activeAccount$.pipe(filterOutNullish());

  protected pendingTasks$ = this.activeAccount$.pipe(
    switchMap((user) =>
      this.taskService
        .pendingTasks$(user.id)
        .pipe(
          map((tasks) => tasks.filter((t) => t.type === SecurityTaskType.UpdateAtRiskCredential)),
        ),
    ),
  );
}
