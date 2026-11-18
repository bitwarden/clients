import {
  catchError,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  of,
  pairwise,
  startWith,
  Subscription,
  switchMap,
  tap,
} from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/** The leased views held per user, as {@link DesktopRevealedCipherService} keeps them. */
export type HeldLeasedViews = ReadonlyMap<UserId, ReadonlyMap<CipherId, CipherView>>;

/** Sent by `PlatformUtilsService.copyToClipboard` for every copy that is not itself a clear. */
const COPIED_TO_CLIPBOARD = new CommandDefinition<{ clipboardValue?: string; clearing?: boolean }>(
  "copiedToClipboard",
);

/** The latest copy, when it came from a held leased view. */
type LeasedCopy = { value: string; from: ReadonlySet<string> };

const heldKey = (userId: UserId, cipherId: CipherId) => `${userId}/${cipherId}`;

/**
 * Clears the OS clipboard when a lease ends, if it still holds a value copied from that leased
 * item. Every copy in the vault goes through `PlatformUtilsService.copyToClipboard`, which carries
 * no item, so a copy counts as leased when its value is one of a held leased view's fields or its
 * current TOTP code.
 *
 * Only the latest copy is kept, in renderer memory, and it is released on the next copy or once
 * the lease it came from ends. It is never logged, stored or sent anywhere.
 */
export class DesktopLeasedClipboardService {
  private copied: LeasedCopy | null = null;

  constructor(
    private readonly messageListener: MessageListener,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly totpService: TotpService,
    private readonly logService: LogService,
  ) {}

  /**
   * Watches copies and the held views. A held view leaving the map is a lease that ended, lapsed
   * or was dropped by a lock, logout or account switch.
   */
  watch(held$: Observable<HeldLeasedViews>): Subscription {
    let held: HeldLeasedViews = new Map();

    const ends$ = held$.pipe(
      tap((next) => (held = next)),
      startWith(new Map() as HeldLeasedViews),
      pairwise(),
      map(([previous, next]) => endedKeys(previous, next)),
      filter((ended) => ended.size > 0),
      tap((ended) => this.onEnded(ended)),
    );

    // switchMap, so a slower TOTP match cannot overwrite a later copy.
    const copies$ = this.messageListener.messages$(COPIED_TO_CLIPBOARD).pipe(
      filter((message) => message.clearing !== true),
      switchMap((message) =>
        from(this.match(message.clipboardValue, held)).pipe(
          catchError(() => of<LeasedCopy | null>(null)),
        ),
      ),
      tap((copied) => (this.copied = copied)),
    );

    return merge(ends$, copies$).subscribe();
  }

  private onEnded(ended: ReadonlySet<string>): void {
    const copied = this.copied;
    if (copied == null || ![...copied.from].some((key) => ended.has(key))) {
      return;
    }
    this.copied = null;
    void this.clearIfStillHeld(copied.value);
  }

  /** The same check `SystemService` makes before its timed clear. */
  private async clearIfStillHeld(value: string): Promise<void> {
    try {
      const clipboardNow = await this.platformUtilsService.readFromClipboard();
      if (clipboardNow === value) {
        this.platformUtilsService.copyToClipboard("", { clearing: true });
      }
    } catch {
      // The error could carry clipboard text, so it is not passed on.
      this.logService.error("Could not clear a leased value from the clipboard.");
    }
  }

  private async match(
    value: string | undefined,
    held: HeldLeasedViews,
  ): Promise<LeasedCopy | null> {
    if (value == null || value === "") {
      return null;
    }
    const from = new Set<string>();
    const totps: { key: string; secret: string }[] = [];
    held.forEach((views, userId) =>
      views.forEach((view, cipherId) => {
        const key = heldKey(userId, cipherId);
        if (leasedValues(view).has(value)) {
          from.add(key);
        }
        if (view.login?.totp) {
          totps.push({ key, secret: view.login.totp });
        }
      }),
    );
    for (const { key, secret } of totps) {
      if (!from.has(key) && (await this.currentTotp(secret)) === value) {
        from.add(key);
      }
    }
    return from.size > 0 ? { value, from } : null;
  }

  private async currentTotp(secret: string): Promise<string | null> {
    try {
      return (await firstValueFrom(this.totpService.getCode$(secret))).code;
    } catch {
      return null;
    }
  }
}

function endedKeys(previous: HeldLeasedViews, next: HeldLeasedViews): Set<string> {
  const ended = new Set<string>();
  previous.forEach((views, userId) =>
    views.forEach((_, cipherId) => {
      if (!next.get(userId)?.has(cipherId)) {
        ended.add(heldKey(userId, cipherId));
      }
    }),
  );
  return ended;
}

/**
 * Every non-empty string in the parts of a view a lease reveals: the notes, each type's fields,
 * custom fields and password history. The name, ids and dates show without a lease, so they are
 * left out.
 */
function leasedValues(view: CipherView): Set<string> {
  const values = new Set<string>();
  const seen = new WeakSet<object>();
  const collect = (node: unknown): void => {
    if (typeof node === "string") {
      if (node !== "") {
        values.add(node);
      }
      return;
    }
    if (node == null || typeof node !== "object" || seen.has(node)) {
      return;
    }
    seen.add(node);
    Object.values(node).forEach(collect);
  };
  [
    view.notes,
    view.login,
    view.card,
    view.identity,
    view.secureNote,
    view.sshKey,
    view.bankAccount,
    view.driversLicense,
    view.passport,
    view.fields,
    view.passwordHistory,
  ].forEach(collect);
  return values;
}
