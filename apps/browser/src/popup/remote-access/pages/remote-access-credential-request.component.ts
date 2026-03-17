import { ChangeDetectionStrategy, Component, input, output, signal, OnInit } from "@angular/core";

import { ButtonModule } from "@bitwarden/components";

import { CredentialMatch, CredentialRequestData } from "../remote-access.types";

@Component({
  selector: "app-remote-access-credential-request",
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container>
      <div class="tw-p-3 tw-space-y-3">
        <p class="tw-text-main tw-text-sm tw-mb-0">
          A connected device is requesting access to a credential from your vault.
        </p>

        <!-- Request card -->
        <div
          class="tw-bg-background-alt tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-px-3 tw-py-2"
        >
          <div class="tw-flex tw-items-center tw-gap-2">
            <i class="bwi bwi-globe tw-text-primary-600 tw-shrink-0"></i>
            <div class="tw-min-w-0">
              <p class="tw-text-main tw-font-semibold tw-text-sm tw-mb-0 tw-truncate">
                {{ request()?.domain }}
              </p>
              <p class="tw-text-muted tw-text-xs tw-mb-0">
                Requested by <strong>{{ request()?.connectionName }}</strong>
              </p>
            </div>
          </div>
        </div>

        @if (request()?.matches?.length) {
          <p class="tw-text-muted tw-text-xs tw-uppercase tw-tracking-wide tw-mb-0">
            Matching vault items
          </p>

          <div class="tw-space-y-1">
            @for (match of request()!.matches; track match.cipherId) {
              <label
                class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded tw-border tw-border-solid tw-cursor-pointer tw-mb-0 tw-transition-colors"
                [class.tw-border-primary-600]="selectedCipherId() === match.cipherId"
                [class.tw-bg-primary-600/5]="selectedCipherId() === match.cipherId"
                [class.tw-border-secondary-300]="selectedCipherId() !== match.cipherId"
                [class.tw-bg-background]="selectedCipherId() !== match.cipherId"
              >
                <input
                  type="radio"
                  name="credential"
                  class="tw-shrink-0"
                  [value]="match.cipherId"
                  [checked]="selectedCipherId() === match.cipherId"
                  (change)="selectMatch(match)"
                />
                <div class="tw-min-w-0">
                  <p class="tw-text-main tw-text-sm tw-font-semibold tw-mb-0 tw-truncate">
                    {{ match.name }}
                  </p>
                  <p class="tw-text-muted tw-text-xs tw-mb-0 tw-truncate">{{ match.username }}</p>
                </div>
              </label>
            }
          </div>

          <div class="tw-flex tw-gap-2">
            <button
              type="button"
              bitButton
              buttonType="primary"
              [disabled]="!selectedCipherId()"
              (click)="onApprove()"
            >
              Approve
            </button>
            <button type="button" bitButton buttonType="danger" (click)="denied.emit()">
              Deny
            </button>
          </div>
        } @else {
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-py-6">
            <svg
              width="36"
              height="36"
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
            <p class="tw-text-main tw-font-bold tw-text-sm tw-mb-0">No matching credentials</p>
            <p class="tw-text-muted tw-text-xs tw-text-center tw-mb-0">
              No saved credentials were found matching
              <strong>{{ request()?.domain }}</strong
              >.
            </p>
          </div>

          <div class="tw-flex tw-justify-center">
            <button type="button" bitButton buttonType="secondary" (click)="denied.emit()">
              Dismiss
            </button>
          </div>
        }
      </div>
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

  selectMatch(match: CredentialMatch): void {
    this.selectedCipherId.set(match.cipherId);
  }

  onApprove(): void {
    const id = this.selectedCipherId();
    if (id) {
      this.approved.emit(id);
    }
  }
}
