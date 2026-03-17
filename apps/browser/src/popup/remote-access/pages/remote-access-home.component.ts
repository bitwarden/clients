import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { ConnectionEntry, CredentialRequestData } from "../remote-access.types";

@Component({
  selector: "app-remote-access-home",
  standalone: true,
  imports: [
    DatePipe,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
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
      <bit-section>
        <bit-section-header>
          <h2 bitTypography="h6">Active Connections</h2>
        </bit-section-header>
        <bit-item-group>
          @for (conn of connections(); track conn.id) {
            <bit-item>
              <bit-item-content>
                <i slot="start" class="bwi bwi-desktop tw-text-2xl tw-text-muted"></i>
                <div class="tw-flex tw-items-center tw-gap-2">
                  {{ conn.name }}
                  @if (pendingRequests().has(conn.id)) {
                    <span
                      class="tw-inline-flex tw-items-center tw-px-1.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-medium tw-bg-warning-600 tw-text-contrast"
                    >
                      Request
                    </span>
                  }
                </div>
                @if (pendingRequests().has(conn.id)) {
                  <span slot="secondary" class="tw-text-warning-600">
                    {{ pendingRequests().get(conn.id)!.domain }}
                  </span>
                } @else {
                  <span slot="secondary"> Last used {{ conn.lastUsed | date: "short" }} </span>
                }
              </bit-item-content>
              @if (pendingRequests().has(conn.id)) {
                <button
                  type="button"
                  slot="end"
                  bitIconButton="bwi-angle-right"
                  label="View request"
                  size="small"
                  (click)="openRequest.emit(conn.id)"
                ></button>
              } @else {
                <button
                  type="button"
                  slot="end"
                  bitIconButton="bwi-close"
                  label="Remove connection"
                  size="small"
                  (click)="removeConnection.emit(conn.id)"
                ></button>
              }
            </bit-item>
          }
        </bit-item-group>
      </bit-section>

      <div class="tw-flex tw-justify-center tw-py-6">
        <button type="button" bitButton buttonType="primary" (click)="addConnection.emit()">
          + Add Connection
        </button>
      </div>
    }
  `,
})
export class RemoteAccessHomeComponent {
  readonly connections = input<ConnectionEntry[]>([]);
  readonly pendingRequests = input<Map<string, CredentialRequestData>>(new Map());

  readonly addConnection = output();
  readonly removeConnection = output<string>();
  readonly openRequest = output<string>();
}
