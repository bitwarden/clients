import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { WebmapperDraftService } from "../../services/webmapper-draft.service";
import {
  addForm,
  cancelPendingContainer,
  editSelectorAt,
  isDraftPristine,
  pickContainerCandidate,
  removeForm,
  removeSelectorAt,
  SelectorEntry,
  SelectorValue,
  setActiveForm,
  setCategory,
  Slot,
  swapAlternateAt,
  toggleIrrelevant,
  toJsonc,
  validateDraft,
  WebmapperDraft,
} from "../../webmapper/draft";
import { CATEGORIES } from "../../webmapper/keys";
import { parseUrl, ParsedUrl } from "../../webmapper/url";

/** Positional address of one selector entry within the draft. */
type SelectorAddress = { formIndex: number; slot: Slot; selectorIndex: number };

function sameSlot(a: Slot, b: Slot): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  // Equal kinds: two container slots always match; keyed slots match on key.
  if (a.kind === "container" || b.kind === "container") {
    return true;
  }
  return a.key === b.key;
}

/**
 * Body-only authoring surface for map-the-web form mappings, rendered inside the
 * autofill-tools shell. Selectors are captured on the page via the right-click
 * webmapper menu (background → content script); this view reviews, edits, and
 * exports the resulting draft. Drafts persist per (host, pathname) and sync
 * across contexts through storage updates.
 */
@Component({
  selector: "app-webmapper",
  templateUrl: "webmapper.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    IconButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class WebmapperComponent implements OnInit, OnDestroy {
  readonly draft = signal<WebmapperDraft | null>(null);
  readonly url = signal<ParsedUrl | null>(null);
  readonly exportText = signal<string | null>(null);

  /** Validation issues blocking export; empty when the draft is ready. */
  readonly issues = computed(() => {
    const draft = this.draft();
    return draft ? validateDraft(draft) : [];
  });

  readonly editing = signal<SelectorAddress | null>(null);
  readonly editValue = signal("");

  readonly categories = CATEGORIES;

  private readonly tabId = signal<number | undefined>(undefined);

  private readonly draftService = inject(WebmapperDraftService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tabChangeListener = (): void => {
    void this.loadForActiveTab();
  };
  private readonly tabUpdatedListener = (
    _tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
  ): void => {
    if (changeInfo.url) {
      void this.loadForActiveTab();
    }
  };
  private readonly feedbackListener = (msg: {
    command: string;
    tabId?: number;
    type?: "success" | "error";
    message?: string;
  }) => {
    if (msg.command !== "webmapperCaptureFeedback" || msg.tabId !== this.tabId()) {
      return;
    }
    this.toastService.showToast({
      variant: msg.type === "error" ? "error" : "success",
      title: "",
      message: msg.message ?? "",
    });
  };

  constructor() {
    // Reload the draft whenever the active page changes, and whenever its stored
    // draft changes in any context — so captures from the page's right-click
    // menu appear live while the panel is open.
    toObservable(this.url)
      .pipe(
        switchMap((url) =>
          url == null ? of(null) : this.draftService.draft$(url.host, url.pathname),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((draft) => this.applyDraft(draft));
  }

  /**
   * Every draft change invalidates the export snapshot: it is copyable text, so one
   * that outlived its draft is indistinguishable from a current document.
   */
  private applyDraft(draft: WebmapperDraft | null) {
    this.draft.set(draft);
    this.exportText.set(null);
  }

  async ngOnInit() {
    await this.loadForActiveTab();
    BrowserApi.addListener(chrome.tabs.onActivated, this.tabChangeListener);
    BrowserApi.addListener(chrome.tabs.onUpdated, this.tabUpdatedListener);
    BrowserApi.addListener(chrome.runtime.onMessage, this.feedbackListener);
  }

  ngOnDestroy() {
    BrowserApi.removeListener(chrome.tabs.onActivated, this.tabChangeListener);
    BrowserApi.removeListener(chrome.tabs.onUpdated, this.tabUpdatedListener);
    BrowserApi.removeListener(chrome.runtime.onMessage, this.feedbackListener);
  }

  private async loadForActiveTab() {
    let tab = await BrowserApi.getCurrentTab();
    if (!tab && BrowserPopupUtils.inSidePanel(window)) {
      const tabs = await BrowserApi.tabsQuery({ active: true, currentWindow: true });
      tab = tabs[0];
    }
    this.tabId.set(tab?.id);
    this.exportText.set(null);
    // An edit belongs to the page it was started on.
    this.cancelEdit();
    // Setting `url` drives the draft-loading pipeline in the constructor.
    this.url.set(tab?.url ? parseUrl(tab.url) : null);
  }

  /**
   * `editing` must never outlive a change to the structure it points into: it is a
   * positional address, and a mutation can renumber or replace the entry there, so a
   * later save would land in whichever entry inherited the index. Dropping the edit
   * here holds that for every action, including ones added later.
   */
  private async mutate(fn: (draft: WebmapperDraft) => void) {
    this.cancelEdit();
    const url = this.url();
    if (!url) {
      return;
    }
    // Applied at write time rather than to the local copy: a background capture
    // can land between the panel's read and its write.
    this.applyDraft(await this.draftService.updateDraft(url.host, url.pathname, fn));
  }

  keysOf(map: Record<string, SelectorEntry[]>): string[] {
    return Object.keys(map);
  }

  selectorText(value: SelectorValue): string {
    return Array.isArray(value) ? value.join("  /  ") : value;
  }

  isArraySelector(value: SelectorValue): boolean {
    return Array.isArray(value);
  }

  // Typed Slot constructors so the template addresses an entry without the
  // union having to be widened (and re-narrowed with a cast) downstream.
  readonly containerSlot: Slot = { kind: "container" };

  fieldsSlot(key: string): Slot {
    return { kind: "fields", key };
  }

  actionsSlot(key: string): Slot {
    return { kind: "actions", key };
  }

  addressAt(formIndex: number, slot: Slot, selectorIndex: number): SelectorAddress {
    return { formIndex, slot, selectorIndex };
  }

  /** Unique DOM-id fragment for an entry's controls; keys are camelCase, so id-safe. */
  addressId(address: SelectorAddress): string {
    const slot =
      address.slot.kind === "container" ? "container" : `${address.slot.kind}-${address.slot.key}`;
    return `${address.formIndex}-${slot}-${address.selectorIndex}`;
  }

  isEditing(address: SelectorAddress): boolean {
    const e = this.editing();
    return (
      !!e &&
      e.formIndex === address.formIndex &&
      e.selectorIndex === address.selectorIndex &&
      sameSlot(e.slot, address.slot)
    );
  }

  setCategory(formIndex: number, value: string) {
    void this.mutate((d) => setCategory(d, formIndex, value));
  }

  setActiveForm(formIndex: number) {
    void this.mutate((d) => setActiveForm(d, formIndex));
  }

  addForm() {
    void this.mutate((d) => addForm(d));
  }

  removeForm(formIndex: number) {
    void this.mutate((d) => removeForm(d, formIndex));
  }

  toggleIrrelevant() {
    void this.mutate((d) => toggleIrrelevant(d));
  }

  pickContainer(formIndex: number, candidateIndex: number) {
    void this.mutate((d) => pickContainerCandidate(d, formIndex, candidateIndex));
  }

  cancelContainer(formIndex: number) {
    void this.mutate((d) => cancelPendingContainer(d, formIndex));
  }

  startEdit(address: SelectorAddress, current: SelectorValue) {
    if (Array.isArray(current)) {
      return; // DEFERRED: sequence (compositeSelector) values are capture/export-only, not inline-editable
    }
    this.editValue.set(current);
    this.editing.set(address);
  }

  saveEdit() {
    // Read both before mutate() — it clears the edit state on the way in.
    const e = this.editing();
    const next = this.editValue().trim();
    if (!e || !next) {
      this.cancelEdit();
      return;
    }
    void this.mutate((d) => editSelectorAt(d, e.formIndex, e.slot, e.selectorIndex, next));
  }

  cancelEdit() {
    this.editing.set(null);
    this.editValue.set("");
  }

  removeSelector(address: SelectorAddress) {
    void this.mutate((d) =>
      removeSelectorAt(d, address.formIndex, address.slot, address.selectorIndex),
    );
  }

  swapAlternate(address: SelectorAddress, alternateIndex: number) {
    void this.mutate((d) =>
      swapAlternateAt(d, address.formIndex, address.slot, address.selectorIndex, alternateIndex),
    );
  }

  async copyJsonc() {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    // Guard the host-wide-null trap (see isDraftPristine).
    if (isDraftPristine(draft)) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: "Nothing captured yet — capture a field before exporting.",
      });
      return;
    }
    const issues = validateDraft(draft);
    if (issues.length) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: `Fix ${issues.length} issue${issues.length === 1 ? "" : "s"} before exporting.`,
      });
      return;
    }
    const text = toJsonc(draft);
    this.exportText.set(text);
    await this.platformUtilsService.copyToClipboard(text);
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: "Copied JSONC to clipboard",
    });
  }

  async clearDraft() {
    const url = this.url();
    if (!url) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: "Discard draft",
      content: "Discard the captured mapping for this page? This can't be undone.",
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.draftService.clearDraft(url.host, url.pathname);
    // The reactive pipeline re-emits an empty draft for this url after the clear.
    this.exportText.set(null);
  }
}
