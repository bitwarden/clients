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

import {
  type CredentialLookupResult,
  CredentialMatch,
  CredentialRequestData,
} from "../../../agent-access/agent-access.types";
import { AgentAccessService } from "../agent-access.service";

@Component({
  selector: "app-agent-access-credential-request",
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container>
      <div class="tw-p-3 tw-space-y-2">
        <p class="tw-text-main tw-text-sm tw-mb-0">
          A connected device is requesting access to a credential from your vault.
        </p>

        <!-- Request card -->
        <div
          class="tw-bg-background tw-border tw-border-dashed tw-border-secondary-300 tw-rounded tw-px-3 tw-py-1.5"
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
              <div
                class="tw-rounded tw-border tw-border-solid tw-transition-colors tw-overflow-hidden tw-bg-background"
                [class.tw-border-primary-600]="expandedMatch()?.cipherId === match.cipherId"
                [class.tw-border-secondary-300]="expandedMatch()?.cipherId !== match.cipherId"
              >
                <!-- Header row -->
                <button
                  type="button"
                  class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-cursor-pointer tw-mb-0 tw-w-full tw-text-left tw-bg-transparent tw-border-0"
                  (click)="toggleExpand(match)"
                >
                  @if (isMultipleMatches()) {
                    <input
                      type="radio"
                      name="matchSelection"
                      class="tw-shrink-0"
                      [checked]="expandedMatch()?.cipherId === match.cipherId"
                      (click)="$event.stopPropagation()"
                      (change)="toggleExpand(match)"
                    />
                  }
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
                  <i
                    class="bwi tw-shrink-0 tw-text-muted tw-text-xs tw-ml-auto"
                    [class.bwi-angle-down]="expandedMatch()?.cipherId === match.cipherId"
                    [class.bwi-angle-right]="expandedMatch()?.cipherId !== match.cipherId"
                  ></i>
                </button>

                <!-- Expanded details (inline) -->
                @if (expandedMatch()?.cipherId === match.cipherId) {
                  <div class="tw-px-3 tw-pb-2 tw-space-y-1">
                    @if (loadingDetails()) {
                      <p class="tw-text-muted tw-text-xs tw-mb-0">Loading credential details…</p>
                    } @else if (credentialDetails()) {
                      <!-- Field checkboxes (vertical layout: label above value) -->
                      @if (credentialDetails()!.username) {
                        <label class="tw-flex tw-items-start tw-gap-2 tw-cursor-pointer tw-mb-0">
                          <input
                            type="checkbox"
                            class="tw-shrink-0 tw-mt-2"
                            [checked]="selectedFields().has('username')"
                            (change)="toggleField('username')"
                          />
                          <div class="tw-min-w-0">
                            <p class="tw-text-muted tw-text-xs tw-mb-0">User name</p>
                            <p class="tw-text-main tw-text-sm tw-mb-0 tw-truncate">
                              {{ credentialDetails()!.username }}
                            </p>
                          </div>
                        </label>
                      }
                      @if (credentialDetails()!.password) {
                        <label class="tw-flex tw-items-start tw-gap-2 tw-cursor-pointer tw-mb-0">
                          <input
                            type="checkbox"
                            class="tw-shrink-0 tw-mt-2"
                            [checked]="selectedFields().has('password')"
                            (change)="toggleField('password')"
                          />
                          <div class="tw-min-w-0">
                            <p class="tw-text-muted tw-text-xs tw-mb-0">Password</p>
                            <div class="tw-flex tw-items-center tw-gap-1">
                              @if (showPassword()) {
                                <span
                                  class="tw-text-main tw-text-sm tw-truncate tw-max-w-[180px]"
                                  >{{ credentialDetails()!.password }}</span
                                >
                              } @else {
                                <span class="tw-text-main tw-text-sm">••••••••</span>
                              }
                              <button
                                type="button"
                                class="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-p-0 tw-text-muted"
                                (click)="showPassword.set(!showPassword()); $event.preventDefault()"
                              >
                                <i
                                  class="bwi tw-text-xs"
                                  [class.bwi-eye]="!showPassword()"
                                  [class.bwi-eye-slash]="showPassword()"
                                ></i>
                              </button>
                            </div>
                          </div>
                        </label>
                      }
                      @if (credentialDetails()!.totp) {
                        <label class="tw-flex tw-items-start tw-gap-2 tw-cursor-pointer tw-mb-0">
                          <input
                            type="checkbox"
                            class="tw-shrink-0 tw-mt-2"
                            [checked]="selectedFields().has('totp')"
                            (change)="toggleField('totp')"
                          />
                          <div class="tw-min-w-0">
                            <p class="tw-text-muted tw-text-xs tw-mb-0">TOTP</p>
                            <p class="tw-text-main tw-text-sm tw-mb-0 tw-truncate">
                              {{ credentialDetails()!.totp }}
                            </p>
                          </div>
                        </label>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Summary line -->
          @if (expandedMatch() && selectedFields().size > 0) {
            <p class="tw-text-muted tw-text-xs tw-mb-0">
              Your <strong>{{ fieldSummary() }}</strong> will be shared with this connection.
            </p>
          }

          <div class="tw-flex tw-gap-2">
            <button
              type="button"
              bitButton
              buttonType="primary"
              [disabled]="!expandedMatch() || selectedFields().size === 0"
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

  readonly approved = output<{ cipherId: string; fields: Set<string> }>();
  readonly denied = output<void>();

  protected readonly expandedMatch = signal<CredentialMatch | null>(null);
  protected readonly selectedFields = signal<Set<string>>(new Set(["username", "password"]));
  protected readonly credentialDetails = signal<CredentialLookupResult | null>(null);
  protected readonly loadingDetails = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly domainIconFailed = signal(false);
  protected readonly iconsUrl = signal<string | null>(null);

  private readonly environmentService = inject(EnvironmentService);
  private readonly agentAccessService = inject(AgentAccessService);

  protected readonly domainIconUrl = computed(() => {
    const base = this.iconsUrl();
    const domain = this.request()?.domain;
    if (!base || !domain) {
      return "";
    }
    const hostname = this.extractHostname(domain);
    return `${base}/${hostname}/icon.png`;
  });

  protected readonly isMultipleMatches = computed(() => {
    return (this.request()?.matches?.length ?? 0) > 1;
  });

  protected readonly fieldSummary = computed(() => {
    const fields = this.selectedFields();
    const labels: string[] = [];
    if (fields.has("username")) {
      labels.push("username");
    }
    if (fields.has("password")) {
      labels.push("password");
    }
    if (fields.has("totp")) {
      labels.push("TOTP");
    }
    if (labels.length <= 1) {
      return labels[0] ?? "";
    }
    return labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
  });

  async ngOnInit(): Promise<void> {
    const url = await firstValueFrom(
      this.environmentService.environment$.pipe(map((e) => e.getIconsUrl())),
    );
    this.iconsUrl.set(url);

    const matches = this.request()?.matches;
    if (matches?.length === 1) {
      await this.toggleExpand(matches[0]);
    }
  }

  async toggleExpand(match: CredentialMatch): Promise<void> {
    if (this.expandedMatch()?.cipherId === match.cipherId) {
      this.expandedMatch.set(null);
      this.credentialDetails.set(null);
      return;
    }

    this.expandedMatch.set(match);
    this.credentialDetails.set(null);
    this.selectedFields.set(new Set(["username", "password"]));
    this.showPassword.set(false);
    this.loadingDetails.set(true);

    const details = await this.agentAccessService.getCredentialById(match.cipherId);
    this.credentialDetails.set(details);
    this.loadingDetails.set(false);
  }

  toggleField(field: string): void {
    this.selectedFields.update((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  onApprove(): void {
    const match = this.expandedMatch();
    if (match && this.selectedFields().size > 0) {
      this.approved.emit({ cipherId: match.cipherId, fields: new Set(this.selectedFields()) });
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
