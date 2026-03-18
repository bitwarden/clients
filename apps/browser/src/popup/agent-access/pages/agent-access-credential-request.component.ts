import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
} from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ButtonModule } from "@bitwarden/components";

import { CredentialMatch, CredentialRequestData } from "../agent-access.types";

@Component({
  selector: "app-agent-access-credential-request",
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
            <img
              [src]="domainIconUrl()"
              class="tw-size-5 tw-shrink-0 tw-rounded-sm"
              (error)="domainIconFailed.set(true)"
              [hidden]="domainIconFailed()"
            />
            @if (domainIconFailed()) {
              <i class="bwi bwi-globe tw-text-primary-600 tw-shrink-0"></i>
            }
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
                <img
                  [src]="getMatchIconUrl(match)"
                  class="tw-size-4 tw-shrink-0 tw-rounded-sm"
                  (error)="$any($event.target).style.display = 'none'"
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
            <i class="bwi bwi-info-circle tw-text-3xl tw-text-muted"></i>
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
export class AgentAccessCredentialRequestComponent implements OnInit {
  readonly request = input.required<CredentialRequestData | null>();

  readonly approved = output<string>();
  readonly denied = output<void>();

  protected readonly selectedCipherId = signal<string>("");
  protected readonly domainIconFailed = signal(false);
  protected readonly iconsUrl = signal<string | null>(null);

  private readonly environmentService = inject(EnvironmentService);

  protected readonly domainIconUrl = computed(() => {
    const base = this.iconsUrl();
    const domain = this.request()?.domain;
    if (!base || !domain) {
      return "";
    }
    const hostname = this.extractHostname(domain);
    return `${base}/${hostname}/icon.png`;
  });

  async ngOnInit(): Promise<void> {
    const matches = this.request()?.matches;
    if (matches && matches.length > 0) {
      this.selectedCipherId.set(matches[0].cipherId);
    }

    const url = await firstValueFrom(
      this.environmentService.environment$.pipe(map((e) => e.getIconsUrl())),
    );
    this.iconsUrl.set(url);
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

  getMatchIconUrl(match: CredentialMatch): string {
    const base = this.iconsUrl();
    if (!base || !match.uri) {
      return "";
    }
    const hostname = this.extractHostname(match.uri);
    return `${base}/${hostname}/icon.png`;
  }

  private extractHostname(uri: string): string {
    try {
      const url = uri.startsWith("http") ? uri : `https://${uri}`;
      return Utils.getHostname(url) ?? uri;
    } catch {
      return uri;
    }
  }
}
