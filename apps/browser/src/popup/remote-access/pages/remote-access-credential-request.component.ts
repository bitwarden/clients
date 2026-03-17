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

        @if (request()?.matches?.length) {
          <div
            class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-3 tw-text-center"
          >
            <p class="tw-text-lg tw-font-bold tw-text-main tw-mb-0">
              {{ request()?.domain }}
            </p>
          </div>

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
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-py-8">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="tw-text-muted"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5ZM1.25 12C1.25 6.063 6.063 1.25 12 1.25S22.75 6.063 22.75 12 17.937 22.75 12 22.75 1.25 17.937 1.25 12Zm10-4a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm1 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
                fill="currentColor"
              />
            </svg>
            <p class="tw-text-main tw-font-bold tw-mb-0">No matching credentials</p>
            <p class="tw-text-muted tw-text-sm tw-text-center tw-mb-0">
              No saved credentials were found matching
              <strong>{{ request()?.domain }}</strong
              >.
            </p>
          </div>
        }
      </div>

      @if (request()?.matches?.length) {
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
      } @else {
        <div class="tw-flex tw-justify-center tw-px-4 tw-pb-4">
          <button type="button" bitButton buttonType="secondary" (click)="denied.emit()">
            Dismiss
          </button>
        </div>
      }
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
