import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CalloutModule,
  FormFieldModule,
  SpinnerComponent,
  ToggleGroupModule,
} from "@bitwarden/components";

import type { ConnectionMode } from "../agent-access.service";

const ConnectionModeEnum = Object.freeze({
  Rendezvous: "rendezvous" as ConnectionMode,
  Psk: "psk" as ConnectionMode,
  Cached: "cached" as ConnectionMode,
} as const);

@Component({
  selector: "app-agent-access-pairing",
  standalone: true,
  imports: [
    JslibModule,
    FormsModule,
    ButtonModule,
    CalloutModule,
    FormFieldModule,
    SpinnerComponent,
    ToggleGroupModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container>
      @switch (stage()) {
        @case ("token") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-toggle-group
              fullWidth
              [selected]="connectionMode()"
              (selectedChange)="modeChanged.emit($event)"
            >
              <bit-toggle [value]="ConnectionModeEnum.Rendezvous">Short Code</bit-toggle>
              <bit-toggle [value]="ConnectionModeEnum.Psk">Machine Key</bit-toggle>
            </bit-toggle-group>

            @switch (connectionMode()) {
              @case ("rendezvous") {
                <div
                  class="tw-bg-background-alt tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-py-5 tw-px-4 tw-text-center"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-3">
                    Share this code with the agent to pair
                  </p>
                  @if (rendezvousCode()) {
                    <p
                      class="tw-text-2xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-4 tw-uppercase"
                    >
                      {{ rendezvousCode() }}
                    </p>
                    <button
                      type="button"
                      bitButton
                      buttonType="secondary"
                      size="small"
                      (click)="copyCode.emit()"
                    >
                      {{ codeCopied() ? "Copied!" : "Copy" }}
                    </button>
                  } @else {
                    <div class="tw-flex tw-justify-center tw-py-4">
                      <bit-spinner size="small"></bit-spinner>
                    </div>
                  }
                </div>

                @if (rendezvousCode()) {
                  <div class="tw-flex tw-items-center tw-gap-2 tw-justify-center tw-text-muted">
                    <bit-spinner size="small"></bit-spinner>
                    <p class="tw-text-sm tw-mb-0">Waiting for connection...</p>
                  </div>
                }
              }
              @case ("psk") {
                <div
                  class="tw-bg-background-alt tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-py-5 tw-px-4 tw-text-center"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-3">
                    Add this key to the agent's configuration
                  </p>
                  @if (pskToken()) {
                    <p class="tw-text-sm tw-font-mono tw-text-main tw-break-all tw-mb-4">
                      {{ pskToken() }}
                    </p>
                    <button
                      type="button"
                      bitButton
                      buttonType="secondary"
                      size="small"
                      (click)="copyToken.emit()"
                    >
                      {{ tokenCopied() ? "Copied!" : "Copy" }}
                    </button>
                  } @else {
                    <div class="tw-flex tw-justify-center tw-py-4">
                      <bit-spinner size="small"></bit-spinner>
                    </div>
                  }
                </div>

                @if (pskToken()) {
                  <div class="tw-flex tw-items-center tw-gap-2 tw-justify-center tw-text-muted">
                    <bit-spinner size="small"></bit-spinner>
                    <p class="tw-text-sm tw-mb-0">Waiting for connection...</p>
                  </div>
                }
              }
            }

            <!-- Connection name -->
            <bit-form-field>
              <bit-label>Connection Name</bit-label>
              <input
                bitInput
                type="text"
                placeholder="e.g. Work Agent"
                [ngModel]="connectionName()"
                (ngModelChange)="nameChanged.emit($event)"
              />
            </bit-form-field>
          </div>
        }
        @case ("fingerprint") {
          <div class="tw-p-4 tw-space-y-4">
            <h3 class="tw-text-main tw-font-bold tw-text-lg tw-mb-0">Verify Connection</h3>
            <p class="tw-text-muted tw-text-sm tw-mb-0">
              Confirm this fingerprint matches what is shown on the remote device. If they do not
              match, reject the connection.
            </p>

            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
            >
              <p class="tw-text-xs tw-text-muted tw-mb-2">Connection Fingerprint</p>
              <p
                class="tw-text-3xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-0"
              >
                {{ fingerprint() }}
              </p>
            </div>

            <!-- Connection name (still editable) -->
            <bit-form-field>
              <bit-label>Connection Name</bit-label>
              <input
                bitInput
                type="text"
                placeholder="e.g. Work Agent"
                [ngModel]="connectionName()"
                (ngModelChange)="nameChanged.emit($event)"
              />
            </bit-form-field>
          </div>

          <div class="tw-flex tw-justify-between tw-px-4 tw-pb-4">
            <button
              type="button"
              bitButton
              buttonType="primary"
              (click)="fingerprintApproved.emit()"
            >
              Accept
            </button>
            <button
              type="button"
              bitButton
              buttonType="danger"
              (click)="fingerprintRejected.emit()"
            >
              Reject
            </button>
          </div>
        }
        @case ("known") {
          <div class="tw-p-4 tw-space-y-4">
            <h3 class="tw-text-main tw-font-bold tw-text-lg tw-mb-0">Known Device</h3>
            <p class="tw-text-muted tw-text-sm tw-mb-0">
              This device is already paired as
              <strong>{{ knownConnectionName() }}</strong
              >. You can update the connection name below.
            </p>

            <bit-form-field>
              <bit-label>New Name</bit-label>
              <input
                bitInput
                type="text"
                [placeholder]="knownConnectionName()"
                [ngModel]="connectionName()"
                (ngModelChange)="nameChanged.emit($event)"
              />
            </bit-form-field>
          </div>

          <div class="tw-flex tw-justify-between tw-px-4 tw-pb-4">
            <button
              type="button"
              bitButton
              buttonType="primary"
              (click)="fingerprintApproved.emit()"
            >
              Update
            </button>
          </div>
        }
        @case ("handshake") {
          <div
            class="tw-p-4 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-h-full"
          >
            <bit-spinner size="large"></bit-spinner>
            <p class="tw-text-main tw-mb-0">
              @if (connectionMode() === "psk") {
                Waiting for connection...
              } @else {
                Performing secure handshake...
              }
            </p>
          </div>
        }
        @case ("connected") {
          <div
            class="tw-p-4 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-h-full"
          >
            <i class="bwi bwi-check-circle tw-text-success tw-text-4xl"></i>
            <p class="tw-text-main tw-font-bold tw-mb-0">Connected!</p>
            <p class="tw-text-muted tw-text-sm tw-mb-0">{{ connectionName() }}</p>
          </div>
        }
      }
    </ng-container>
  `,
})
export class AgentAccessPairingComponent {
  protected readonly ConnectionModeEnum = ConnectionModeEnum;

  readonly stage = input.required<"token" | "fingerprint" | "known" | "handshake" | "connected">();
  readonly connectionMode = input.required<ConnectionMode>();
  readonly rendezvousCode = input("");
  readonly pskToken = input("");
  readonly fingerprint = input("");
  readonly connectionName = input("");
  readonly knownConnectionName = input("");
  readonly codeCopied = input(false);
  readonly tokenCopied = input(false);

  readonly modeChanged = output<ConnectionMode>();
  readonly copyCode = output();
  readonly copyToken = output();
  readonly nameChanged = output<string>();
  readonly fingerprintApproved = output();
  readonly fingerprintRejected = output();
}
