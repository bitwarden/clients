import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

type CharacterType = "letter" | "emoji" | "special" | "number";

const emojiPresentation = /\p{Emoji_Presentation}/u;

const characterStyles: Record<CharacterType, string> = {
  emoji: "",
  letter: "tw-text-main",
  special: "tw-text-danger",
  number: "tw-text-primary-600",
};

const countStyles =
  "tw-inline-flex tw-flex-col tw-items-center tw-w-7 tw-py-1 odd:tw-bg-secondary-100 even:tw-bg-background";

function characterType(character: string): CharacterType {
  if (emojiPresentation.test(character)) {
    return "emoji";
  }
  if (/\d/.test(character)) {
    return "number";
  }
  if (["&", "<", ">", " "].includes(character) || /[^\w ]/.test(character)) {
    return "special";
  }
  return "letter";
}

/**
 * Displays a password with letters, numbers, and special characters in distinct colors. Used in
 * the generator and the login form. Copying a selection copies only the password characters.
 */
@customElement("bit-color-password")
export class BitColorPassword extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        min-width: 0;
        white-space: pre-wrap;
        overflow-wrap: break-word;
      }
    `,
  ];

  @property() password = "";

  /** Show each character's position below it. */
  @property({ type: Boolean, attribute: "show-count" }) showCount = false;

  constructor() {
    super();
    this.addEventListener("copy", this.onCopy);
  }

  // Array.from splits by code point, so emoji stay whole.
  private get characters() {
    return Array.from(this.password ?? "");
  }

  private onCopy = (event: ClipboardEvent) => {
    const root = this.shadowRoot;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) {
      return;
    }
    // Selections are retargeted at shadow boundaries; composed ranges expose the real endpoints.
    const [composed] = selection.getComposedRanges?.({ shadowRoots: [root] }) ?? [
      selection.getRangeAt(0),
    ];
    if (!composed) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(root);
    if (root.contains(composed.startContainer)) {
      range.setStart(composed.startContainer, composed.startOffset);
    }
    if (root.contains(composed.endContainer)) {
      range.setEnd(composed.endContainer, composed.endOffset);
    }
    const characters = this.characters;
    const copied = Array.from(root.querySelectorAll("[data-password-character]"))
      .map((span, i) => (range.intersectsNode(span) ? characters[i] : ""))
      .join("");
    if (copied) {
      event.preventDefault();
      event.clipboardData?.setData("text/plain", copied);
    }
  };

  // Whitespace between tags would render under `pre-wrap`, so the markup is kept on one line.
  render() {
    const characters = this.characters;
    const charSpans = characters.map(
      (character, i) =>
        html`<span
          class="tw-font-mono ${characterStyles[characterType(character)]} ${
            this.showCount ? countStyles : ""
          }"
          data-password-character
          aria-hidden=${this.showCount ? nothing : "true"}
          ><span>${character}</span>${
            this.showCount
              ? html`<span class="tw-whitespace-nowrap tw-text-xs tw-leading-5 tw-text-main"
                  >${i + 1}</span
                >`
              : nothing
          }</span
        >`,
    );
    // Separate characters so screen readers announce each one instead of grouping letters into
    // words. Spaces become a localized token because screen readers drop bare whitespace.
    const accessible = this.showCount
      ? nothing
      : html`<span class="tw-sr-only" data-password-accessible
          >${characters.map(
            (char) => html`<code>${char === " " ? t("passwordAnnounceSpace") : char}</code>`,
          )}</span
        >`;
    return html`${charSpans}${accessible}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-color-password": BitColorPassword;
  }
}
