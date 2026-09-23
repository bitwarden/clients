import { Dialog } from "@angular/cdk/dialog";
import {
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injectable,
  NgZone,
  OnDestroy,
  Signal,
  computed,
  inject,
  signal,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { detectInitialModifier, isPrimaryModifier } from "./modifier-key";

/** A chord an owner wants to claim. */
export interface KeyboardShortcut {
  /** Lowercase Latin letter the chord uses, e.g. `"f"`. */
  key: string;
  /** Physical key, e.g. `"KeyF"`. Used only when the layout reports a non-Latin `key`. */
  code: string;
  /** Whether this owner currently wants the chord. Re-read on every press. */
  enabled: () => boolean;
  /** Runs when this owner wins the chord. */
  handler: () => void;
}

interface Registration extends KeyboardShortcut {
  host: HTMLElement;
  /** Registration order, used as the final tie-break. Unique, so a winner always exists. */
  seq: number;
}

const LATIN_LETTER = /^[a-z]$/;

/**
 * Arbitrates primary-modifier chords (⌘/Ctrl + a letter) across the whole page from one document
 * listener, and tracks which modifier this platform uses.
 *
 * Owners register through {@link injectKeyboardShortcut}. Exactly one eligible owner wins a given
 * press; if none is eligible the event is left alone, so the browser's native binding still works.
 */
@Injectable({ providedIn: "root" })
export class KeyboardShortcutService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly ngZone = inject(NgZone);
  private readonly dialog = inject(Dialog);

  private readonly registrations = new Set<Registration>();
  private nextSeq = 0;

  private readonly modifier = signal(detectInitialModifier(this.document));

  /**
   * The platform's primary modifier. Seeded from `navigator`, then corrected to `"Command"` the
   * first time a Cmd chord is seen. The correction is one-way: Cmd is Apple-exclusive, but a Ctrl
   * chord proves nothing, since the macOS caret bindings (Ctrl+A/E/K/D) fire while typing.
   */
  readonly modifierKey: Signal<"Command" | "Ctrl"> = this.modifier.asReadonly();

  // Capture phase so arbitration happens before any component handler, and outside the zone so a
  // keystroke that matches nothing cannot tick change detection.
  private readonly listener = (event: KeyboardEvent) => this.handle(event);

  constructor() {
    this.ngZone.runOutsideAngular(() =>
      this.document.addEventListener("keydown", this.listener, true),
    );
  }

  ngOnDestroy(): void {
    this.document.removeEventListener("keydown", this.listener, true);
  }

  /** Prefer {@link injectKeyboardShortcut}, which unregisters on destroy for you. */
  register(shortcut: KeyboardShortcut, host: HTMLElement): () => void {
    const registration: Registration = { ...shortcut, host, seq: this.nextSeq++ };
    this.registrations.add(registration);
    return () => this.registrations.delete(registration);
  }

  private handle(event: KeyboardEvent): void {
    this.trackModifier(event);

    if (event.repeat || event.isComposing || event.defaultPrevented) {
      return;
    }
    if (!isPrimaryModifier(event) || event.altKey || event.shiftKey) {
      return;
    }

    const winner = this.claim(event);
    if (winner == null) {
      return;
    }

    event.preventDefault();
    this.ngZone.run(() => winner.handler());
  }

  private trackModifier(event: KeyboardEvent): void {
    // The Windows key also reports as "Meta", so a bare modifier press is not evidence.
    if (event.key === "Meta" || event.key === "Control") {
      return;
    }
    if (event.metaKey && !event.ctrlKey && this.modifier() !== "Command") {
      this.ngZone.run(() => this.modifier.set("Command"));
    }
  }

  private claim(event: KeyboardEvent): Registration | undefined {
    const candidates = [...this.registrations].filter(
      (r) => this.matches(event, r) && this.eligible(r),
    );
    if (candidates.length === 0) {
      return undefined;
    }

    const nearest = this.nearFocus(candidates);
    const pool = nearest.length > 0 ? nearest : candidates;
    return pool.reduce((best, r) => (r.seq > best.seq ? r : best));
  }

  /**
   * `key` is authoritative so a remapped Latin layout follows the user's keycaps; `code` is a
   * fallback only when the layout reports a non-Latin `key`, which is what makes the chord reachable
   * on Cyrillic, Greek, and Arabic without letting any layout hijack it onto a different letter.
   */
  private matches(event: KeyboardEvent, registration: Registration): boolean {
    const key = event.key.toLowerCase();
    return (
      key === registration.key || (event.code === registration.code && !LATIN_LETTER.test(key))
    );
  }

  private eligible(registration: Registration): boolean {
    if (!registration.enabled() || !registration.host.isConnected) {
      return false;
    }
    if (registration.host.closest("[inert]") != null) {
      return false;
    }

    // An open dialog takes the page: owners outside it defer, so the browser's native binding is
    // what a user gets while a dialog has their attention.
    const topDialog = this.dialog.openDialogs.at(-1);
    return topDialog == null || topDialog.overlayRef.overlayElement.contains(registration.host);
  }

  /** Owners whose subtree the focused element shares, which is how a nested overlay outranks the page. */
  private nearFocus(candidates: Registration[]): Registration[] {
    const active = this.document.activeElement;
    if (
      active == null ||
      active === this.document.body ||
      active === this.document.documentElement
    ) {
      return [];
    }
    return candidates.filter((r) => r.host.contains(active) || active.contains(r.host));
  }
}

/**
 * Claims a primary-modifier chord for the calling component, releasing it on destroy.
 * Must be called in an injection context.
 */
export function injectKeyboardShortcut(shortcut: KeyboardShortcut): void {
  const host = inject(ElementRef<HTMLElement>).nativeElement;
  const unregister = inject(KeyboardShortcutService).register(shortcut, host);
  inject(DestroyRef).onDestroy(unregister);
}

/**
 * Returns a readonly signal tracking the platform modifier key label
 * ("Command" on Mac, "Ctrl" elsewhere). Must be called in an injection context.
 */
export function injectModifierKey(): Signal<"Command" | "Ctrl"> {
  return inject(KeyboardShortcutService).modifierKey;
}

/**
 * Returns a readonly signal of the platform modifier key as it should be *displayed* — the
 * locale-independent "⌘" on Mac, the localized Control abbreviation elsewhere (Strg on German
 * keyboards, for instance). Must be called in an injection context.
 */
export function injectModifierGlyph(): Signal<string> {
  const key = injectModifierKey();
  const i18nService = inject(I18nService);
  return computed(() => (key() === "Command" ? "⌘" : i18nService.t("keyControl")));
}

/**
 * Returns a readonly signal of the platform modifier key as it should be *spoken*. Use this rather
 * than {@link injectModifierGlyph} in live-region text: "⌘" does not read aloud usefully.
 * Must be called in an injection context.
 */
export function injectModifierLabel(): Signal<string> {
  const key = injectModifierKey();
  const i18nService = inject(I18nService);
  return computed(() => i18nService.t(key() === "Command" ? "keyCommand" : "keyControl"));
}
