import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, CalloutModule } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";

@Component({
  selector: "app-agent-access-status",
  standalone: true,
  imports: [JslibModule, PopupFooterComponent, ButtonModule, CalloutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ("disconnected") {
        <ng-container>
          <div class="tw-p-4">
            <bit-callout type="info"> Remote device disconnected. </bit-callout>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="action.emit()">
              Back to Home
            </button>
          </popup-footer>
        </ng-container>
      }
      @case ("error") {
        <ng-container>
          <div class="tw-p-4">
            <bit-callout type="danger" title="Error">
              {{ errorMessage() }}
            </bit-callout>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="action.emit()">
              Try Again
            </button>
          </popup-footer>
        </ng-container>
      }
    }
  `,
})
export class AgentAccessStatusComponent {
  readonly status = input.required<"disconnected" | "error">();
  readonly errorMessage = input("");

  readonly action = output();
}
