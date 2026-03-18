import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, IconButtonModule } from "@bitwarden/components";

import { ConnectionEntry, CredentialRequestData } from "../agent-access.types";

@Component({
  selector: "app-agent-access-home",
  standalone: true,
  imports: [DatePipe, JslibModule, ButtonModule, IconButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connections().length === 0) {
      <!-- Empty state -->
      <div class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-py-16 tw-px-6">
        <i class="bwi bwi-desktop tw-text-3xl tw-text-muted"></i>
        <p class="tw-text-main tw-font-bold tw-text-lg tw-mb-0">No connections yet</p>
        <p class="tw-text-muted tw-text-sm tw-mb-0 tw-text-center tw-max-w-52">
          Pair a device to allow agents to request credentials
        </p>
        <button
          type="button"
          bitButton
          buttonType="primary"
          class="tw-mt-4"
          (click)="addConnection.emit()"
        >
          + Add Connection
        </button>
      </div>
    } @else {
      <!-- Connection list -->
      <div class="tw-space-y-3 tw-px-4 tw-pt-4">
        @for (conn of connections(); track conn.id) {
          <div
            class="tw-flex tw-items-center tw-gap-2 tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-px-3 tw-py-2"
          >
            <!-- Wifi icon in circle -->
            <div
              class="tw-flex tw-items-center tw-justify-center tw-size-8 tw-rounded-full tw-bg-primary-600/10 tw-shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="19" r="1.5" class="tw-fill-primary-600" />
                <path
                  d="M8.82 15.18a4.5 4.5 0 0 1 6.36 0"
                  stroke-width="2"
                  stroke-linecap="round"
                  class="tw-stroke-primary-600"
                />
                <path
                  d="M5.64 12a9 9 0 0 1 12.72 0"
                  stroke-width="2"
                  stroke-linecap="round"
                  class="tw-stroke-primary-600"
                />
                <path
                  d="M2.46 8.82a13.5 13.5 0 0 1 19.08 0"
                  stroke-width="2"
                  stroke-linecap="round"
                  class="tw-stroke-primary-600"
                />
              </svg>
            </div>

            <!-- Name + date -->
            <div class="tw-flex-1 tw-min-w-0">
              <p class="tw-text-main tw-font-semibold tw-text-sm tw-mb-0 tw-truncate">
                {{ conn.name }}
                @if (pendingRequests().has(conn.id)) {
                  <span
                    class="tw-inline-flex tw-items-center tw-px-1.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-bg-warning-600 tw-text-contrast tw-ml-1"
                  >
                    Request
                  </span>
                }
              </p>
              @if (pendingRequests().has(conn.id)) {
                <p class="tw-text-warning-600 tw-text-xs tw-mb-0">
                  {{ pendingRequests().get(conn.id)!.domain }}
                </p>
              } @else {
                <p class="tw-text-muted tw-text-xs tw-mb-0">
                  Connected {{ conn.lastUsed | date: "short" }}
                </p>
              }
            </div>

            <!-- Actions -->
            @if (pendingRequests().has(conn.id)) {
              <button
                type="button"
                bitIconButton="bwi-angle-right"
                label="View request"
                size="small"
                (click)="openRequest.emit(conn.id)"
              ></button>
            } @else {
              <button
                type="button"
                class="tw-flex tw-items-center tw-gap-1 tw-text-primary-600 tw-text-sm tw-font-medium tw-bg-transparent tw-border-0 tw-cursor-pointer tw-shrink-0 tw-px-1"
                (click)="renameConnection.emit(conn.id)"
              >
                <i class="bwi bwi-pencil-square"></i> Rename
              </button>
              <button
                type="button"
                class="tw-flex tw-items-center tw-text-danger tw-bg-transparent tw-border-0 tw-cursor-pointer tw-shrink-0 tw-px-1"
                (click)="removeConnection.emit(conn.id)"
              >
                <i class="bwi bwi-trash"></i>
              </button>
            }
          </div>
        }
      </div>

      <div class="tw-flex tw-justify-center tw-py-6">
        <button type="button" bitButton buttonType="primary" (click)="addConnection.emit()">
          + Add Connection
        </button>
      </div>
    }
  `,
})
export class AgentAccessHomeComponent {
  readonly connections = input<ConnectionEntry[]>([]);
  readonly pendingRequests = input<Map<string, CredentialRequestData>>(new Map());

  readonly addConnection = output();
  readonly renameConnection = output<string>();
  readonly removeConnection = output<string>();
  readonly openRequest = output<string>();
}
