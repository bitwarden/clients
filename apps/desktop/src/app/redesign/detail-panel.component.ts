import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  CopyBridgeService,
  ItemDetail,
  PasswordStrengthBridgeService,
  VaultViewModelService,
} from "@klappstuhl/ui-bridge";
import {
  KlsButtonComponent,
  KlsCopyFieldComponent,
  KlsRevealFieldComponent,
  KlsTotpRingComponent,
} from "@klappstuhl/ui-kit";
import { interval } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * Right pane: item detail using the ui-kit primitives. Preview-only copy writes
 * to the clipboard directly (mock data); in production this routes through the
 * bridge CopyService. TOTP code/countdown are mocked here — real codes come from
 * core's TotpService via the bridge.
 */
@Component({
  selector: "kls-detail-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    KlsButtonComponent,
    KlsCopyFieldComponent,
    KlsRevealFieldComponent,
    KlsTotpRingComponent,
  ],
  host: {
    class: "tw-flex tw-h-full tw-flex-1 tw-flex-col tw-bg-bg-primary tw-overflow-hidden",
  },
  styles: [
    `
      .detail-content {
        animation: fadeSlideIn var(--fk-dur-base, 250ms) var(--fk-ease, ease) both;
      }
      @keyframes fadeSlideIn {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .detail-section + .detail-section {
        border-top: var(--fk-glass-border);
      }
      .meta-row + .meta-row {
        border-top: var(--fk-glass-border);
      }
      @media (prefers-reduced-motion: reduce) {
        .detail-content {
          animation: none;
        }
      }
    `,
  ],
  template: `
    @let it = item();
    @if (it) {
      <div class="detail-content tw-flex tw-h-full tw-flex-col" [attr.data-id]="it.id">
        <div
          class="tw-flex tw-items-center tw-gap-4 tw-px-8 tw-py-6"
          style="border-bottom: var(--fk-glass-border)"
        >
          <span
            class="tw-flex tw-size-12 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-[var(--fk-radius-lg)]"
            style="background: linear-gradient(135deg, var(--fk-card-bg), var(--fk-selected-bg)); border: var(--fk-glass-border-strong); box-shadow: var(--fk-glass-highlight), var(--fk-elev-sm)"
          >
            @if (it.iconUrl) {
              <img
                [src]="it.iconUrl"
                class="tw-size-7 tw-object-contain"
                alt=""
                (error)="$any($event.target).style.display = 'none'"
              />
            } @else {
              <span class="tw-text-lg tw-font-bold tw-text-fg-brand">{{
                it.title.charAt(0).toUpperCase()
              }}</span>
            }
          </span>
          <div class="tw-min-w-0 tw-flex-1">
            <h1
              class="tw-truncate tw-text-[22px] tw-font-semibold tw-leading-tight tw-text-fg-heading"
            >
              {{ it.title }}
            </h1>
            <p class="tw-mt-0.5 tw-text-[13px] tw-capitalize tw-text-fg-body-subtle">
              {{ it.kind }}
            </p>
          </div>
          <div class="tw-flex tw-shrink-0 tw-items-center tw-gap-2">
            <button
              type="button"
              class="tw-rounded-[var(--fk-radius-full)] tw-p-2.5"
              style="transition: all var(--fk-dur-fast) var(--fk-ease-spring); background-color: transparent"
              [class.tw-text-fg-warning]="it.favorite"
              [class.tw-text-fg-body-subtle]="!it.favorite"
              [attr.aria-label]="it.favorite ? 'Remove from favorites' : 'Add to favorites'"
              [attr.aria-pressed]="it.favorite"
              (mouseenter)="$any($event.currentTarget).style.transform = 'scale(1.15)'"
              (mouseleave)="$any($event.currentTarget).style.transform = 'scale(1)'"
              (click)="onToggleFavorite()"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                [attr.fill]="it.favorite ? 'currentColor' : 'none'"
                aria-hidden="true"
              >
                <path
                  d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            @if (editing()) {
              <button
                type="button"
                klsButton
                variant="secondary"
                size="sm"
                [disabled]="saving()"
                (click)="onCancelEdit()"
              >
                Cancel
              </button>
              <button
                type="button"
                klsButton
                variant="primary"
                size="sm"
                [disabled]="saving()"
                (click)="onSave()"
              >
                {{ saving() ? "Saving…" : "Save" }}
              </button>
            } @else {
              <button type="button" klsButton variant="secondary" size="sm" (click)="onStartEdit()">
                Edit
              </button>
            }
          </div>
        </div>

        <div class="tw-flex-1 tw-overflow-y-auto tw-px-8 tw-py-6">
          <div
            class="tw-rounded-[var(--fk-radius-xl)] tw-px-5 tw-py-1"
            style="background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle)); border: var(--fk-glass-border-strong); box-shadow: var(--fk-glass-highlight), var(--fk-elev-sm)"
          >
            @if (editing()) {
              <div class="tw-py-3" style="border-bottom: var(--fk-glass-border)">
                <label
                  class="tw-mb-1 tw-block tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >Title</label
                >
                <input
                  type="text"
                  class="tw-w-full tw-rounded-[var(--fk-radius-md)] tw-bg-[var(--fk-hover-bg)] tw-px-3 tw-py-2 tw-text-[14px] tw-text-fg-heading tw-outline-none focus:tw-ring-2 focus:tw-ring-[color:var(--color-border-focus)]"
                  style="border: var(--fk-glass-border)"
                  [ngModel]="draft().title"
                  (ngModelChange)="updateDraft('title', $event)"
                />
              </div>
              <div class="tw-py-3" style="border-bottom: var(--fk-glass-border)">
                <label
                  class="tw-mb-1 tw-block tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >Username</label
                >
                <input
                  type="text"
                  class="tw-w-full tw-rounded-[var(--fk-radius-md)] tw-bg-[var(--fk-hover-bg)] tw-px-3 tw-py-2 tw-text-[14px] tw-text-fg-heading tw-outline-none focus:tw-ring-2 focus:tw-ring-[color:var(--color-border-focus)]"
                  style="border: var(--fk-glass-border)"
                  [ngModel]="draft().username ?? ''"
                  (ngModelChange)="updateDraft('username', $event)"
                />
              </div>
              <div class="tw-py-3" style="border-bottom: var(--fk-glass-border)">
                <label
                  class="tw-mb-1 tw-block tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >Password</label
                >
                <input
                  type="text"
                  class="tw-w-full tw-rounded-[var(--fk-radius-md)] tw-bg-[var(--fk-hover-bg)] tw-px-3 tw-py-2 tw-font-mono tw-text-[14px] tw-text-fg-heading tw-outline-none focus:tw-ring-2 focus:tw-ring-[color:var(--color-border-focus)]"
                  style="border: var(--fk-glass-border)"
                  [ngModel]="draft().password ?? ''"
                  (ngModelChange)="updateDraft('password', $event)"
                />
              </div>
              <div class="tw-py-3" style="border-bottom: var(--fk-glass-border)">
                <label
                  class="tw-mb-1 tw-block tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >URIs</label
                >
                @for (uri of draft().uris ?? []; track $index) {
                  <div class="tw-mb-2 tw-flex tw-items-center tw-gap-2">
                    <input
                      type="url"
                      class="tw-flex-1 tw-rounded-[var(--fk-radius-md)] tw-bg-[var(--fk-hover-bg)] tw-px-3 tw-py-2 tw-text-[14px] tw-text-fg-heading tw-outline-none focus:tw-ring-2 focus:tw-ring-[color:var(--color-border-focus)]"
                      style="border: var(--fk-glass-border)"
                      [ngModel]="uri"
                      (ngModelChange)="updateUri($index, $event)"
                    />
                    <button
                      type="button"
                      class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-p-1.5 tw-text-fg-body-subtle"
                      style="transition: color var(--fk-dur-fast) var(--fk-ease)"
                      (mouseenter)="
                        $any($event.currentTarget).style.color = 'var(--color-fg-danger)'
                      "
                      (mouseleave)="$any($event.currentTarget).style.color = ''"
                      (click)="removeUri($index)"
                      aria-label="Remove URI"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M18 6 6 18M6 6l12 12"
                          stroke="currentColor"
                          stroke-width="1.75"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                }
                <button
                  type="button"
                  class="tw-mt-1 tw-text-[12px] tw-font-medium tw-text-fg-brand"
                  style="transition: opacity var(--fk-dur-fast) var(--fk-ease)"
                  (click)="addUri()"
                >
                  + Add URI
                </button>
              </div>
              <div class="tw-py-3">
                <label
                  class="tw-mb-1 tw-block tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >Notes</label
                >
                <textarea
                  rows="4"
                  class="tw-w-full tw-resize-y tw-rounded-[var(--fk-radius-md)] tw-bg-[var(--fk-hover-bg)] tw-px-3 tw-py-2 tw-text-[14px] tw-leading-relaxed tw-text-fg-heading tw-outline-none focus:tw-ring-2 focus:tw-ring-[color:var(--color-border-focus)]"
                  style="border: var(--fk-glass-border)"
                  [ngModel]="draft().notes ?? ''"
                  (ngModelChange)="updateDraft('notes', $event)"
                ></textarea>
              </div>
            } @else {
              @if (it.username) {
                <div class="detail-section">
                  <kls-copy-field
                    [label]="i18n.t('username') || 'Username'"
                    [value]="it.username"
                    (copy)="onCopy($event)"
                  />
                </div>
              }
              @if (it.password) {
                <div class="detail-section tw-flex tw-items-center tw-gap-2">
                  <kls-reveal-field
                    class="tw-min-w-0 tw-flex-1"
                    [label]="i18n.t('password') || 'Password'"
                    [value]="it.password"
                    [(revealed)]="passwordRevealed"
                    (copy)="onCopy($event)"
                  />
                  <span
                    class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase"
                    [style.color]="strengthColor()"
                    [style.background-color]="strengthBg()"
                    >{{ strengthLabel() }}</span
                  >
                </div>
              }
              @if (it.totpAvailable) {
                <div class="detail-section tw-flex tw-items-center tw-gap-4 tw-py-3">
                  <div class="tw-flex-1">
                    <div
                      class="tw-mb-1 tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                    >
                      {{ i18n.t("verificationCode") || "Verification code" }}
                    </div>
                    <button
                      type="button"
                      class="tw-font-mono tw-text-[20px] tw-font-semibold tw-tracking-[0.12em] tw-text-fg-brand"
                      title="Click to copy"
                      (click)="onCopy(totpCode())"
                    >
                      {{ formatTotp(totpCode()) }}
                    </button>
                  </div>
                  <kls-totp-ring
                    [remaining]="totpRemaining()"
                    [period]="totpPeriod()"
                    [size]="38"
                  />
                </div>
              }
              @if ((it.uris ?? []).length > 0) {
                <div class="detail-section tw-py-3">
                  <div
                    class="tw-mb-2 tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >
                    {{ i18n.t("website") || "Website" }}
                  </div>
                  @for (uri of it.uris!; track uri) {
                    <div class="tw-flex tw-items-center tw-gap-1 tw-py-1">
                      <button
                        type="button"
                        class="tw-min-w-0 tw-flex-1 tw-truncate tw-text-left tw-text-[14px] tw-text-fg-body"
                        style="transition: color var(--fk-dur-fast) var(--fk-ease)"
                        (mouseenter)="
                          $any($event.currentTarget).style.color = 'var(--color-fg-brand)'
                        "
                        (mouseleave)="$any($event.currentTarget).style.color = ''"
                        (click)="onCopy(uri)"
                        title="Copy"
                      >
                        {{ uri }}
                      </button>
                      <a
                        [href]="uri"
                        target="_blank"
                        rel="noopener"
                        class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-p-1.5 tw-text-fg-body-subtle"
                        style="transition: all var(--fk-dur-fast) var(--fk-ease-spring)"
                        title="Open in browser"
                        (mouseenter)="
                          $any($event.currentTarget).style.color = 'var(--color-fg-brand)';
                          $any($event.currentTarget).style.transform = 'scale(1.1)'
                        "
                        (mouseleave)="
                          $any($event.currentTarget).style.color = '';
                          $any($event.currentTarget).style.transform = 'scale(1)'
                        "
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                            stroke="currentColor"
                            stroke-width="1.75"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </a>
                    </div>
                  }
                </div>
              }
              @if (it.notes) {
                <div class="detail-section tw-py-3">
                  <div
                    class="tw-mb-1 tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wider tw-text-fg-body-subtle"
                  >
                    {{ i18n.t("notes") || "Notes" }}
                  </div>
                  <p
                    class="tw-whitespace-pre-line tw-text-[14px] tw-leading-relaxed tw-text-fg-body"
                  >
                    {{ it.notes }}
                  </p>
                </div>
              }
              @if (!it.username && !it.password && !it.notes && (it.uris ?? []).length === 0) {
                <p class="tw-py-8 tw-text-center tw-text-[13px] tw-text-fg-body-subtle">
                  {{ it.subtitle || "No additional details." }}
                </p>
              }
            }
          </div>

          <!-- Metadata section -->
          @if (!editing() && (it.folderName || it.collectionNames?.length || it.revisionDate)) {
            <div
              class="tw-mt-4 tw-rounded-[var(--fk-radius-xl)] tw-px-5 tw-py-3"
              style="background-color: var(--fk-card-bg); border: var(--fk-glass-border)"
            >
              @if (it.folderName) {
                <div class="meta-row tw-flex tw-items-center tw-gap-2.5 tw-py-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="tw-text-fg-body-subtle"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
                      stroke="currentColor"
                      stroke-width="1.75"
                    />
                  </svg>
                  <span class="tw-text-[12px] tw-text-fg-body-subtle">{{
                    i18n.t("folder") || "Folder"
                  }}</span>
                  <span class="tw-ml-auto tw-text-[12px] tw-font-medium tw-text-fg-body">{{
                    it.folderName
                  }}</span>
                </div>
              }
              @if (it.collectionNames?.length) {
                <div class="meta-row tw-flex tw-items-start tw-gap-2.5 tw-py-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="tw-mt-0.5 tw-text-fg-body-subtle"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.75"
                    />
                    <rect
                      x="14"
                      y="3"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.75"
                    />
                    <rect
                      x="3"
                      y="14"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.75"
                    />
                    <rect
                      x="14"
                      y="14"
                      width="7"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.75"
                    />
                  </svg>
                  <span class="tw-text-[12px] tw-text-fg-body-subtle">{{
                    i18n.t("collections") || "Collections"
                  }}</span>
                  <span
                    class="tw-ml-auto tw-text-right tw-text-[12px] tw-font-medium tw-text-fg-body"
                    >{{ it.collectionNames.join(", ") }}</span
                  >
                </div>
              }
              @if (it.revisionDate) {
                <div class="meta-row tw-flex tw-items-center tw-gap-2.5 tw-py-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="tw-text-fg-body-subtle"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
                    <path
                      d="M12 7v5l3 3"
                      stroke="currentColor"
                      stroke-width="1.75"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="tw-text-[12px] tw-text-fg-body-subtle">{{
                    i18n.t("dateUpdated") || "Updated"
                  }}</span>
                  <span class="tw-ml-auto tw-text-[12px] tw-text-fg-body">{{
                    formatDate(it.revisionDate)
                  }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else {
      <div
        class="tw-flex tw-flex-1 tw-flex-col tw-items-center tw-justify-center tw-gap-3 tw-text-fg-body-subtle"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          class="tw-opacity-30"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path d="M3 10h18" stroke="currentColor" stroke-width="1.5" />
          <circle cx="12" cy="15" r="1.5" fill="currentColor" />
        </svg>
        <span class="tw-text-[13px]">{{
          i18n.t("selectAnItem") || "Select an item to view its details."
        }}</span>
      </div>
    }
  `,
})
export class KlsDetailPanelComponent {
  readonly item = input<ItemDetail | undefined>(undefined);
  readonly saved = output<void>();

  private readonly el = inject(ElementRef);
  private readonly copyService = inject(CopyBridgeService);
  private readonly strengthService = inject(PasswordStrengthBridgeService);
  private readonly vaultService = inject(VaultViewModelService);
  protected readonly i18n = inject(I18nService);

  private readonly now = signal(Date.now());
  protected readonly totpCode = signal("------");
  protected readonly totpPeriod = signal(30);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly draft = signal<Partial<ItemDetail>>({});
  protected readonly passwordRevealed = signal(false);

  constructor() {
    effect(() => {
      const it = this.item();
      if (!it) {
        return;
      }
      this.passwordRevealed.set(false);
      this.editing.set(false);
      const content = (this.el.nativeElement as HTMLElement).querySelector(".detail-content");
      if (content) {
        content.classList.remove("detail-content");
        void (content as HTMLElement).offsetWidth;
        content.classList.add("detail-content");
      }
    });

    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.now.set(Date.now());
        void this.refreshTotp();
      });
  }

  protected readonly strength = computed(() => this.strengthService.score(this.item()?.password));

  protected readonly strengthLabel = computed(() => {
    const s = this.strength();
    if (s <= 1) {
      return "Weak";
    }
    if (s <= 2) {
      return "Fair";
    }
    if (s <= 3) {
      return "Good";
    }
    return "Strong";
  });

  protected readonly strengthColor = computed(() => {
    const s = this.strength();
    if (s <= 1) {
      return "rgb(var(--fk-strength-weak))";
    }
    if (s <= 2) {
      return "rgb(var(--fk-strength-medium))";
    }
    return "rgb(var(--fk-strength-strong))";
  });

  protected readonly strengthBg = computed(() => {
    const s = this.strength();
    if (s <= 1) {
      return "rgb(var(--fk-strength-weak) / 0.12)";
    }
    if (s <= 2) {
      return "rgb(var(--fk-strength-medium) / 0.12)";
    }
    return "rgb(var(--fk-strength-strong) / 0.12)";
  });

  protected readonly totpRemaining = computed(
    () => this.totpPeriod() - (Math.floor(this.now() / 1000) % this.totpPeriod()),
  );

  protected onCopy(value: string): void {
    this.copyService.copyToClipboard(value);
  }

  protected formatTotp(code: string): string {
    if (code.length === 6) {
      return code.slice(0, 3) + " " + code.slice(3);
    }
    if (code.length === 8) {
      return code.slice(0, 4) + " " + code.slice(4);
    }
    return code;
  }

  protected formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  protected onToggleFavorite(): void {
    const id = this.item()?.id;
    if (id) {
      void this.vaultService.toggleFavorite(id);
    }
  }

  protected onStartEdit(): void {
    const it = this.item();
    if (!it) {
      return;
    }
    this.draft.set({ ...it });
    this.editing.set(true);
  }

  protected onCancelEdit(): void {
    this.editing.set(false);
    this.draft.set({});
  }

  protected async onSave(): Promise<void> {
    const it = this.item();
    const d = this.draft();
    if (!it || !d.id) {
      return;
    }
    const updated: ItemDetail = { ...it, ...d } as ItemDetail;
    this.saving.set(true);
    try {
      await this.vaultService.save(updated);
      this.editing.set(false);
      this.draft.set({});
      this.saved.emit();
    } finally {
      this.saving.set(false);
    }
  }

  protected updateDraft(field: keyof ItemDetail, value: string): void {
    this.draft.set({ ...this.draft(), [field]: value || undefined });
  }

  protected updateUri(index: number, value: string): void {
    const uris = [...(this.draft().uris ?? [])];
    uris[index] = value;
    this.draft.set({ ...this.draft(), uris });
  }

  protected removeUri(index: number): void {
    const uris = [...(this.draft().uris ?? [])];
    uris.splice(index, 1);
    this.draft.set({ ...this.draft(), uris });
  }

  protected addUri(): void {
    const uris = [...(this.draft().uris ?? []), ""];
    this.draft.set({ ...this.draft(), uris });
  }

  private async refreshTotp(): Promise<void> {
    const id = this.item()?.id;
    if (!id || !this.item()?.totpAvailable) {
      return;
    }
    try {
      const result = await this.vaultService.getTotpCode(id);
      if (result) {
        this.totpCode.set(result.code);
        this.totpPeriod.set(result.period);
      }
    } catch {
      // Fall back to mock in Storybook/preview
      const window = Math.floor(this.now() / 30000);
      this.totpCode.set(
        Math.abs((window * 9301 + 49297) % 1000000)
          .toString()
          .padStart(6, "0"),
      );
    }
  }
}
