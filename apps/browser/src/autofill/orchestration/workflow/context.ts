import type { UserId } from "@bitwarden/common/types/guid";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { LiveFrame, ResolvedTransitionReport } from "../../lifecycle/transition-buffer";
import type AutofillField from "../../models/autofill-field";
import type { PageDetail } from "../../services/abstractions/autofill.service";

import type { CipherSource, FillRequestKind } from "./enums";
import type { UnsafeFillOptions } from "./types";

/** The document a transition report names: the frame that reported, and the report's deadline. */
export type ReportedDocument = Pick<
  ResolvedTransitionReport,
  "frameId" | "documentId" | "expiresAt"
>;

/**
 * The options a fill's caller may give, such as the focused field. They override the plan's, except
 * the options only a plan decides: whether an untrusted iframe may be filled, and whether the fill
 * submits. This is the type for a caller of the orchestrator; `omitProtectedOptions` makes one from
 * `AutoFillOptions`.
 */
export type FillOptions = Readonly<
  Omit<UnsafeFillOptions, "allowUntrustedIframe" | "autoSubmitLogin">
>;

/** A fill of a tab the request carries. */
type RequestedTab = Readonly<{
  /** The account the fill was requested for. */
  userId: UserId;
  tab: chrome.tabs.Tab;
  /** The frame the fill reads and fills. `undefined` for every frame of the tab. */
  frameId?: number;
  /**
   * The tab's top frame as the browser reported it when the fill was requested; `undefined` when it
   * was gone. It never rejects. An entry point starts this read as soon as it is called, before it
   * awaits anything, so the document is the one the request was made for.
   */
  topFrame: Promise<LiveFrame | undefined>;
}>;

/**
 * What a fill was asked to do. Every request names the account it was made for. A plan's phases read
 * the parts of the request their sub-plans call for; a request without them makes the fill invalid.
 */
export type FillRequest =
  | Readonly<{
      kind: typeof FillRequestKind.Reported;
      /** The account the fill was requested for: the one active when the transition was reported. */
      userId: UserId;
      report: ReportedDocument &
        Readonly<{
          tabId: number;
          /** The tab's URL when the transition was reported. It selects the cipher. */
          url: string | undefined;
        }>;
    }>
  | (RequestedTab & Readonly<{ kind: typeof FillRequestKind.Tab }>)
  | (RequestedTab &
      Readonly<{
        kind: typeof FillRequestKind.Cipher;
        cipher: CipherView;
        options?: FillOptions;
        /**
         * Which of the collected page's fields the fill may fill; every field when absent. A frame
         * with no field the predicate allows is dropped, and a page left with none reports no fill.
         */
        fields?: (field: AutofillField) => boolean;
      }>)
  | (RequestedTab &
      Readonly<{
        kind: typeof FillRequestKind.Page;
        cipher: CipherView;
        pageDetails: PageDetail[];
        options?: FillOptions;
      }>);

/** The requests of the kinds `Kind` names. */
export type FillRequestOf<Kind extends FillRequestKind> = Extract<FillRequest, { kind: Kind }>;

/**
 * The tab a fill is anchored to, and the document its top frame held when the fill was requested.
 * See `model.md`, "The target".
 */
export type FillTarget = Readonly<{
  tabId: number;
  /** The tab as it was when its document was read. */
  tab: chrome.tabs.Tab;
  /** The frame the fill reads and fills. `undefined` for every frame of the tab. */
  frameId: number | undefined;
  /** The URL that selects the cipher. It does not verify the page. */
  url: string | undefined;
  /**
   * The document the tab's top frame held when the fill was requested. A fill requested in response
   * to a transition report reads it when its target is resolved.
   */
  documentId: string;
  /** For a reported target, the document the report names. `frameId` is `undefined` for the top frame. */
  report?: ReportedDocument;
}>;

/** What the target phase adds to the context. */
export type Targeted = Readonly<{ target: FillTarget }>;

/** What the read adds to the context: the details of the page's frames that offer fields. */
export type Paged = Readonly<{ page: PageDetail[] }>;

/**
 * The cipher to fill, where it came from, and the key of the rotation it was taken from. A login's
 * rotation is keyed by the target's URL. A cipher the request carries has no rotation.
 */
export type FillSelection = Readonly<{
  cipher: CipherView;
  source: CipherSource;
  rotation?: string;
}>;

/** What the select phase adds to the context. */
export type Selected = Readonly<{ selection: FillSelection }>;

/** The context the target phase reads. */
export type TargetContext = FillRequest;
/** The context the read reads. */
export type ReadContext = FillRequest & Targeted;
/** The context the select phase reads. */
export type SelectContext = ReadContext & Paged;
/** The context the reprompt, the commit, and the effects read. */
export type FillContext = SelectContext & Selected;
