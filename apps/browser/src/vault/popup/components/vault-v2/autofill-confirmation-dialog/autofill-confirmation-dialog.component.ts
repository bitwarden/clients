import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  ButtonModule,
  DialogService,
  DialogModule,
  TypographyModule,
  CalloutComponent,
  LinkModule,
} from "@bitwarden/components";

export interface AutofillConfirmationDialogParams {
  savedUrls?: string[];
  currentUrl: string;
  uriMatchStrategy: UriMatchStrategySetting;
}

export const AutofillConfirmationDialogResult = Object.freeze({
  AutofillAndUrlAdded: "added",
  AutofilledOnly: "autofilled",
  Canceled: "canceled",
} as const);

export type AutofillConfirmationDialogResultType = UnionOfValues<
  typeof AutofillConfirmationDialogResult
>;

@Component({
  templateUrl: "./autofill-confirmation-dialog.component.html",
  imports: [
    ButtonModule,
    CalloutComponent,
    CommonModule,
    DialogModule,
    LinkModule,
    TypographyModule,
    JslibModule,
  ],
})
export class AutofillConfirmationDialogComponent {
  UriMatchStrategy = UriMatchStrategy;

  currentUrl: string = "";
  savedUrls: string[] = [];
  savedUrlsExpanded = false;
  uriMatchStrategy: UriMatchStrategySetting | null = null;

  // Exact-match view state
  currentTail: string = "";
  currentTailDiff: string = "";
  currentSuffix: string = "";
  currentPrefix: string = "";
  savedTailDiffs: Array<{ host: string; diffSeg: string; suffix: string }> = [];

  constructor(
    @Inject(DIALOG_DATA) protected params: AutofillConfirmationDialogParams,
    private dialogRef: DialogRef,
  ) {
    this.uriMatchStrategy = params.uriMatchStrategy ?? null;

    this.currentUrl = Utils.getHostname(params.currentUrl) ?? "";
    this.savedUrls =
      params.savedUrls?.map((url) => Utils.getHostname(url) ?? "").filter(Boolean) ?? [];

    if (this.uriMatchStrategy === UriMatchStrategy.Exact) {
      this.computeExactDiffs(params);
    }
  }

  private computeExactDiffs(params: AutofillConfirmationDialogParams) {
    const currentHost = Utils.getHostname(params.currentUrl) ?? "";
    const currentTail = this.getTail(params.currentUrl) ?? "/";

    const pairs =
      params.savedUrls
        ?.map((url) => {
          const host = Utils.getHostname(url) ?? "";
          if (host === currentHost) {
            return { host, url };
          } else {
            return null;
          }
        })
        .filter((p): p is { host: string; url: string } => {
          return !!p;
        }) ?? [];

    const savedTails = pairs.map((p) => {
      return this.getTail(p.url) ?? "/";
    });

    const di = this.firstDiffIndexAmong(savedTails, currentTail);

    // Current row
    const curParts = this.splitAtDiffSegment(currentTail, di);
    this.currentTail = currentTail;
    this.currentTailDiff = curParts.diffSeg; // may be ""
    this.currentSuffix = curParts.suffix; // may be ""
    this.currentPrefix = curParts.prefix; // used when there is no suffix (prefix-case context)

    // Saved rows
    // Saved rows — use a *per-row* diff index so we don't lose boundary ('/') info
    this.savedTailDiffs = savedTails.map((tail, i) => {
      const localDi = this.firstDiffIndex(tail, currentTail);
      const parts = this.splitAtDiffSegment(tail, localDi);

      // If the diff starts on a boundary, render diffSeg with a leading slash ("/andmore")
      const diffWithSlash = parts.startsOnBoundary ? `/${parts.diffSeg}` : parts.diffSeg;

      return {
        host: pairs[i].host,
        diffSeg: diffWithSlash,
        suffix: parts.suffix,
      };
    });

    this.savedUrls = pairs.map((p) => {
      return p.host;
    });
  }

  private splitAtDiffSegment(
    tail: string,
    startIdx: number,
  ): { prefix: string; diffSeg: string; suffix: string; startsOnBoundary: boolean } {
    const len = tail.length;
    const isBoundary = (ch: string | undefined) => ch === "/" || ch === "?" || ch === "#";

    if (startIdx >= len) {
      // No diff inside this tail (e.g., current is a strict prefix)
      // Prefix should be the *last segment* (incl. its leading '/'), for context.
      const lastSlash = tail.lastIndexOf("/");
      const prefix = lastSlash >= 0 ? tail.slice(lastSlash) : tail; // e.g., "/somepath"
      return { prefix, diffSeg: "", suffix: "", startsOnBoundary: false };
    }

    const startsOnBoundary = isBoundary(tail[startIdx]);

    // Determine the segment start (segStart) that contains the diff
    let segStart = startIdx;
    if (startsOnBoundary) {
      // Prefix case: diff begins right at a boundary (e.g., "/andmore")
      segStart = startIdx + 1; // start at 'a' of "andmore"
    } else {
      // Backtrack so we include the whole token (e.g., "v2", "alpha")
      const lastSlash = tail.lastIndexOf("/", startIdx);
      const lastQ = tail.lastIndexOf("?", startIdx);
      const lastHash = tail.lastIndexOf("#", startIdx);
      const prevBoundary = Math.max(lastSlash, lastQ, lastHash); // -1 if none
      segStart = prevBoundary >= 0 ? prevBoundary + 1 : 0;
    }

    // Compute a short prefix for context: from the previous boundary up to segStart
    const prevBoundaryForPrefix = Math.max(
      tail.lastIndexOf("/", segStart - 1),
      tail.lastIndexOf("?", segStart - 1),
      tail.lastIndexOf("#", segStart - 1),
    );
    const prefix =
      prevBoundaryForPrefix >= 0
        ? tail.slice(prevBoundaryForPrefix, segStart)
        : tail.slice(0, segStart);
    // Examples:
    // - ".../somepath" then segStart at 'a' of "andmore" -> prefix="/"
    // - ".../products/" then segStart at 'a' of "alpha"  -> prefix="/"

    // Find the end of the differing segment at the next boundary
    const nextSlash = tail.indexOf("/", segStart);
    const nextQ = tail.indexOf("?", segStart);
    const nextHash = tail.indexOf("#", segStart);

    let segEnd = len;
    for (const idx of [nextSlash, nextQ, nextHash]) {
      if (idx !== -1 && idx < segEnd) {
        segEnd = idx;
      }
    }

    const diffSeg = tail.slice(segStart, segEnd); // e.g., "v2", "andmore", "alpha"
    const suffix = tail.slice(segEnd); // e.g., "/some-path", "", "?x=1"
    return { prefix, diffSeg, suffix, startsOnBoundary };
  }

  /** path + search + hash after host */
  private getTail(uri: string | null | undefined): string | null {
    if (Utils.isNullOrWhitespace(uri)) {
      return null;
    }

    const url = Utils.getUrl(uri.trim());
    if (!url) {
      return null;
    }

    return `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
  }

  /** Shared diff index across list vs current */
  private firstDiffIndexAmong(list: string[], current: string): number {
    if (!list.length) {
      return 0;
    }

    let min = Infinity;
    for (const s of list) {
      const idx = this.firstDiffIndex(s, current);
      if (idx < min) {
        min = idx;
      }
    }

    return Number.isFinite(min) ? min : 0;
  }

  /** First differing character index between two strings */
  private firstDiffIndex(a: string, b: string): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) {
        return i;
      }
    }
    return len;
  }

  protected get savedUrlsListClass(): string {
    if (this.savedUrlsExpanded) {
      return "";
    } else {
      return `tw-relative
         tw-max-h-24
         tw-overflow-hidden
         after:tw-pointer-events-none after:tw-content-['']
         after:tw-absolute after:tw-inset-x-0 after:tw-bottom-0
         after:tw-h-8 after:tw-bg-gradient-to-t
         after:tw-from-[var(--surface-bg,white)] after:tw-to-transparent`;
    }
  }

  protected viewAllSavedUrls() {
    this.savedUrlsExpanded = true;
  }

  protected close() {
    this.dialogRef.close(AutofillConfirmationDialogResult.Canceled);
  }

  protected autofillAndAddUrl() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  }

  protected autofillOnly() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofilledOnly);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AutofillConfirmationDialogParams>,
  ) {
    return dialogService.open<AutofillConfirmationDialogResultType>(
      AutofillConfirmationDialogComponent,
      { ...config },
    );
  }
}
