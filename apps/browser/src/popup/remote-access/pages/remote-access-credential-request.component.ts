import { ChangeDetectionStrategy, Component, input, output, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ButtonModule, RadioButtonModule } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { CredentialRequestData } from "../remote-access.types";

@Component({
  selector: "app-remote-access-credential-request",
  standalone: true,
  imports: [FormsModule, PopupFooterComponent, ButtonModule, RadioButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container>
      <div class="tw-p-4 tw-space-y-4">
        <p class="tw-text-main tw-mb-0">
          <strong>{{ request()?.connectionName }}</strong> is requesting a credential for:
        </p>

        <div
          class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-3 tw-text-center"
        >
          <p class="tw-text-lg tw-font-bold tw-text-main tw-mb-0">
            {{ request()?.domain }}
          </p>
        </div>

        @if (request()?.matches?.length) {
          <bit-radio-group
            [ngModel]="selectedCipherId()"
            (ngModelChange)="selectedCipherId.set($event)"
          >
            @for (match of request()!.matches; track match.cipherId) {
              <bit-radio-button [value]="match.cipherId">
                <bit-label>
                  {{ match.name }}
                  <span class="tw-text-muted tw-text-sm tw-ml-2">{{ match.username }}</span>
                </bit-label>
              </bit-radio-button>
            }
          </bit-radio-group>
        } @else {
          <p class="tw-text-muted tw-text-sm tw-text-center tw-py-4 tw-mb-0">
            No matching credentials found for this domain.
          </p>
        }
      </div>

      <popup-footer slot="footer">
        <button
          type="button"
          bitButton
          buttonType="primary"
          [disabled]="!selectedCipherId()"
          (click)="approved.emit(selectedCipherId())"
        >
          Approve
        </button>
        <button type="button" bitButton buttonType="danger" slot="end" (click)="denied.emit()">
          Deny
        </button>
      </popup-footer>
    </ng-container>
  `,
})
export class RemoteAccessCredentialRequestComponent implements OnInit {
  readonly request = input.required<CredentialRequestData | null>();

  readonly approved = output<string>();
  readonly denied = output<void>();

  protected readonly selectedCipherId = signal<string>("");

  ngOnInit(): void {
    const matches = this.request()?.matches;
    if (matches && matches.length > 0) {
      this.selectedCipherId.set(matches[0].cipherId);
    }
  }
}
