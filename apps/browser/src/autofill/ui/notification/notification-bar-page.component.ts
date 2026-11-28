import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { NotificationBarMessagingService } from "./notification-bar-messaging.service";
import { NotificationBarComponent } from "./notification-bar.component";

/** Root of the notification bar iframe page. */
@Component({
  selector: "autofill-notification-bar-page",
  imports: [NotificationBarComponent],
  providers: [NotificationBarMessagingService],
  host: { class: "tw-block tw-px-4" },
  template: `
    @if (messaging.state(); as state) {
      <autofill-notification-bar
        [state]="state"
        (closeNotification)="messaging.close()"
        (save)="messaging.save($event)"
        (update)="messaging.update($event)"
        (edit)="messaging.edit()"
        (openVault)="messaging.openVault()"
        (openTasks)="messaging.openTasks()"
        (changePassword)="messaging.changePassword()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBarPageComponent {
  protected readonly messaging = inject(NotificationBarMessagingService);
}
