import { ContextConsumer } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { trapFocus } from "../core/focus";
import { t } from "../core/i18n";
import "../icon-button/icon-button";
import "../spinner/spinner";

import { AutofocusFallbackHost, DialogRef, dialogRefContext } from "./dialog-ref";
import { drawerSizeToWidthRem, drawerStack } from "./drawer";

export type DialogSize = "small" | "default" | "large";

const dialogSizeToWidth: Record<DialogSize, string> = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-xl",
  large: "md:tw-max-w-3xl",
};

const drawerSizeToWidth: Record<DialogSize, string> = {
  small: "md:tw-max-w-sm",
  default: "md:tw-max-w-lg",
  large: "md:tw-max-w-2xl",
};

/**
 * Dialog layout with a header, scrollable body and optional footer. Open it with `openDialog` /
 * `openDrawer`; inside a drawer it renders as a full-height side panel with a back button when
 * stacked. To submit a form, wrap the dialog: `<form><bit-dialog>…</bit-dialog></form>`.
 *
 * @slot - Body content.
 * @slot title - Extra content in the heading, e.g. a badge.
 * @slot header-start - Content before the heading.
 * @slot header-end - Content before the close button.
 * @slot footer - Actions. Buttons stay associated with an enclosing form.
 */
@customElement("bit-dialog")
export class BitDialog extends BitElement implements AutofocusFallbackHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        max-height: 100%;
      }
      :host([data-drawer]) {
        height: 100%;
      }
    `,
  ];

  /** Heading text. (`title` would show a native tooltip over the whole dialog.) */
  @property() heading?: string;

  @property() subtitle?: string;

  /** Use `large` for complex dialogs. */
  @property({ attribute: "dialog-size" }) dialogSize: DialogSize = "default";

  @property() background: "default" | "alt" = "default";

  @property({ type: Boolean, attribute: "disable-animations" }) disableAnimations = false;

  /** Replaces the body with a spinner. */
  @property({ type: Boolean }) loading = false;

  @state() private hasFooter = false;

  @state() private footerHasIconButton = false;

  @state() private scrolledTop = false;

  @state() private scrolledBottom = false;

  @state() private scrollable = false;

  @state() private animationCompleted = false;

  @query("h2") private headingEl!: HTMLElement;

  @query(".body") private bodyEl!: HTMLElement;

  @query("section") private sectionEl!: HTMLElement;

  private readonly refConsumer = new ContextConsumer(
    this,
    dialogRefContext,
    (ref) => this.watchRef(ref),
    true,
  );
  private watchedRef?: DialogRef<any, any>;
  private unsubscribeDrawers?: () => void;
  private untrap?: () => void;
  private resizeObserver?: ResizeObserver;

  private get ref() {
    return this.refConsumer.value;
  }

  private get isDrawer() {
    return !!this.ref?.isDrawer;
  }

  /** Focus target when nothing in the dialog has `autofocus`: the heading, which gives context. */
  autofocusFallback() {
    return this.headingEl;
  }

  /** Moves focus to the heading, e.g. when switching between dialogs. */
  focusHeader() {
    this.headingEl?.focus();
  }

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribeDrawers = drawerStack.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribeDrawers?.();
    this.watchedRef?.removeEventListener("change", this.onRefChange);
    this.watchedRef = undefined;
    this.untrap?.();
    this.untrap = undefined;
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated() {
    this.untrap = trapFocus(this.sectionEl);
    this.resizeObserver = new ResizeObserver(() => this.measureScroll());
    this.resizeObserver.observe(this.bodyEl);
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (!this.untrap && this.sectionEl) {
      this.untrap = trapFocus(this.sectionEl);
    }
    this.toggleAttribute("data-drawer", this.isDrawer);
    if (this.ref) {
      const label = [this.heading, this.subtitle, this.slotText("title")].filter(Boolean).join(" ");
      this.ref.label = label;
    }
    if (this.isDrawer) {
      this.declarePushWidth();
    }
  }

  private watchRef(ref: DialogRef<any, any> | undefined) {
    this.watchedRef?.removeEventListener("change", this.onRefChange);
    this.watchedRef = ref;
    ref?.addEventListener("change", this.onRefChange);
  }

  private declarePushWidth() {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    drawerStack.declarePushWidth((drawerSizeToWidthRem[this.dialogSize] ?? 32) * rootFontSize);
  }

  private onRefChange = () => this.requestUpdate();

  private slotText(name: string) {
    const slot = this.renderRoot?.querySelector<HTMLSlotElement>(`slot[name=${name}]`);
    return (
      slot
        ?.assignedNodes({ flatten: true })
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .join(" ") ?? ""
    );
  }

  private measureScroll = () => {
    const body = this.bodyEl;
    if (!body) {
      return;
    }
    this.scrolledTop = body.scrollTop > 0;
    // 1px threshold: Chrome reports 0.5px remaining at the bottom-most position.
    this.scrolledBottom = body.scrollHeight - body.clientHeight - body.scrollTop > 1;
    this.scrollable = body.scrollHeight > body.clientHeight;
  };

  private closeDialog = async () => {
    if (this.isDrawer) {
      await drawerStack.closeAll();
    } else {
      void this.ref?.close();
    }
  };

  private onFooterSlotChange = (event: Event) => {
    const elements = (event.target as HTMLSlotElement).assignedElements();
    this.hasFooter = elements.length > 0;
    this.footerHasIconButton = elements.some(
      (el) => el.matches("bit-icon-button") || !!el.querySelector("bit-icon-button"),
    );
  };

  render() {
    const isDrawer = this.isDrawer;
    const disableClose = !!this.ref?.disableClose;
    const isStacked = isDrawer && drawerStack.depth > 1;
    const width = isDrawer
      ? drawerStack.isPushMode
        ? drawerSizeToWidth[this.dialogSize]
        : ""
      : dialogSizeToWidth[this.dialogSize];
    const animation =
      this.disableAnimations || this.animationCompleted || isDrawer
        ? ""
        : this.dialogSize === "small"
          ? "tw-animate-slide-down"
          : "tw-animate-slide-up md:tw-animate-slide-down";

    const wrapperClasses = [
      "tw-flex tw-flex-col tw-min-h-0",
      isDrawer ? "tw-w-full tw-h-full" : "tw-w-screen md:tw-p-4 tw-max-h-[90vh]",
      width,
      animation,
    ].join(" ");

    const showFooterBorder = (!this.scrolledTop && this.scrollable) || this.scrolledBottom;

    return html`<div
      class=${wrapperClasses}
      @animationend=${() => (this.animationCompleted = true)}
    >
      <section
        part="base"
        class="tw-flex tw-w-full tw-min-h-0 tw-flex-col tw-self-center tw-overflow-hidden tw-border tw-border-solid tw-border-secondary-100 tw-bg-background tw-text-main ${width} ${
          isDrawer ? "tw-h-full tw-border-t-0" : "tw-rounded-t-xl md:tw-rounded-xl tw-shadow-lg"
        }"
      >
        <header
          class="tw-flex tw-justify-between tw-items-center tw-gap-2 tw-border-0 tw-border-b tw-border-solid tw-ps-6 ${
            isDrawer ? "tw-py-4" : "tw-py-3"
          } ${disableClose ? "tw-pe-4" : isDrawer ? "tw-pe-4" : "tw-pe-2"} ${
            this.scrolledTop ? "tw-border-secondary-100" : "tw-border-transparent"
          }"
        >
          ${
            isStacked
              ? html`<bit-icon-button
                  icon="bwi-angle-left"
                  button-type="primaryGhost"
                  label=${t("back")}
                  ?disabled=${disableClose}
                  @click=${() => void this.ref?.close()}
                ></bit-icon-button>`
              : nothing
          }
          <slot name="header-start"></slot>
          <h2
            data-testid="bit-dialog-title"
            class="tw-flex-1 tw-text-xl tw-font-medium tw-text-main tw-m-0 tw-line-clamp-2 tw-text-ellipsis tw-break-words focus-visible:tw-outline-none"
            tabindex="-1"
          >
            ${this.heading}
            ${
              this.subtitle
                ? html`<span class="tw-text-muted tw-font-normal tw-text-sm"
                    >${this.subtitle}</span
                  >`
                : nothing
            }
            <slot name="title" @slotchange=${() => this.requestUpdate()}></slot>
          </h2>
          <div class="tw-flex tw-items-center tw-justify-center">
            <slot name="header-end"></slot>
            ${
              disableClose
                ? nothing
                : html`<bit-icon-button
                    data-testid="bit-dialog-dismiss"
                    icon="bwi-close"
                    button-type="primaryGhost"
                    label=${t("close")}
                    @click=${this.closeDialog}
                  ></bit-icon-button>`
            }
          </div>
        </header>

        <div
          class="tw-relative tw-flex-1 tw-flex tw-flex-col tw-overflow-hidden tw-min-h-0 ${
            this.loading ? "tw-min-h-60" : ""
          } ${this.background === "alt" ? "tw-bg-background-alt" : "tw-bg-background"}"
        >
          ${
            this.loading
              ? html`<div
                  class="tw-absolute tw-flex tw-size-full tw-items-center tw-justify-center"
                >
                  <bit-spinner></bit-spinner>
                </div>`
              : nothing
          }
          <div
            class="body tw-ps-6 tw-pe-6 ${this.background === "alt" ? "tw-py-4" : "tw-py-2"} ${
              this.hasFooter ? "" : "tw-pb-4"
            } ${this.loading ? "tw-invisible tw-overflow-y-hidden" : "tw-overflow-y-auto"}"
            tabindex="0"
            @scroll=${this.measureScroll}
          >
            <slot @slotchange=${this.measureScroll}></slot>
          </div>
        </div>

        <div
          class="tw-border-0 tw-border-t tw-border-solid ${
            showFooterBorder ? "tw-border-secondary-100" : "tw-border-transparent"
          }"
          ?hidden=${!this.hasFooter}
        ></div>
        <footer
          class="tw-flex tw-flex-row tw-items-center tw-gap-2 tw-bg-background tw-py-5 tw-ps-6 ${
            !isDrawer && this.footerHasIconButton ? "tw-pe-2" : "tw-pe-4"
          }"
          ?hidden=${!this.hasFooter}
        >
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </footer>
      </section>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-dialog": BitDialog;
  }
}
