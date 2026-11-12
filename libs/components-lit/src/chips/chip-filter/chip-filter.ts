import { css, html, nothing, PropertyValues, unsafeCSS } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { BitFormControlElement } from "../../core/form-control";
import { t } from "../../core/i18n";
import "../../icon/icon";
import { BitwardenIcon } from "../../icon/shared-icon";
import "../../icon-tile/icon-tile";
import { resolveIconTileColor, resolveIconTileVariant } from "../../icon-tile/icon-tile-options";
import "../../menu/menu";
import type { BitMenu } from "../../menu/menu";
import { menuTrigger } from "../../menu/menu-directive";
import "../../menu/menu-item";
import type { SelectOption } from "../../select/option";
import { renderChipContent, renderDismissButton } from "../shared/chip-content";
import { chipClasses, chipHostCss } from "../shared/chip-styles";

/**
 * An option shown in the menu of `bit-chip-filter`. `iconTile` takes precedence over `icon` when
 * both are set.
 */
export type ChipFilterOption<T> = Omit<SelectOption<T>, "icon"> & {
  /** The options that will be nested under this option */
  children?: ChipFilterOption<T>[];
  icon?: BitwardenIcon;
  /**
   * Classes for the option's icon, e.g. `tw-text-danger`. The icon renders in this component's
   * shadow root, so only classes present in the library's stylesheet apply.
   */
  iconClass?: string;
};

/** Deep equality on primitives and JSON-serializable objects (`compareValues` in libs/common). */
function compareValues<T>(a: T, b: T): boolean {
  if (a == null || b == null) {
    return a == null && b == null;
  }
  if (typeof a !== "object" || typeof b !== "object") {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * A select chip commonly used to filter items in lists or tables. Opens a `bit-menu` of options,
 * which can be nested via `children`. Form-associated: the selected option's `value` is the
 * control's value.
 *
 * @deprecated Use `bit-filter-menu` (from the `filter-menu` family) instead.
 *
 * @fires change - The user selected or cleared an option.
 * @csspart trigger - The button that opens the menu.
 * @cssprop --bit-chip-max-width - Maximum width before the label truncates. Defaults to 13rem.
 */
@customElement("bit-chip-filter")
export class BitChipFilter<T = unknown> extends BitFormControlElement<T | null> {
  static shadowRootOptions = { ...BitFormControlElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitFormControlElement.styles,
    css`
      ${unsafeCSS(chipHostCss)}
      /* An inline icon-tile host gains descender space; force a flex box so it stays centered. */
      bit-icon-tile {
        display: flex;
      }
    `,
  ];

  /** The selected option's value. Set from an attribute, it is a string. */
  @property() value: T | null = null;

  /** Text to show when there is no selected option. */
  @property({ attribute: "placeholder-text" }) placeholderText = "";

  /** Icon to show when there is no selected option or the selected option has no icon. */
  @property({ attribute: "placeholder-icon" }) placeholderIcon?: BitwardenIcon;

  /** The options to render. */
  @property({ attribute: false }) options: ChipFilterOption<T>[] = [];

  /** Stretch to the full width of the container. */
  @property({ type: Boolean, attribute: "full-width", reflect: true }) fullWidth = false;

  /** Options currently displayed in the menu. */
  @state() private renderedOptions?: ChipFilterOption<T> | null;

  @state() private menuOpen = false;

  /** Width captured on open so navigating submenus doesn't resize the menu. */
  @state() private menuWidth: number | null = null;

  @query("bit-menu") private menu!: BitMenu;

  @query("[part=trigger]") private trigger!: HTMLButtonElement;

  @query("[data-chip]") private chipEl!: HTMLElement;

  private rootTree?: ChipFilterOption<T>;

  private childParentMap = new Map<ChipFilterOption<T>, ChipFilterOption<T>>();

  protected get validationTarget() {
    return this.trigger ?? undefined;
  }

  /** The selected option, looked up by `value` in the (possibly nested) options. */
  get selectedOption(): ChipFilterOption<T> | null {
    if (this.value == null) {
      return null;
    }
    return this.findOption(this.rootTree, this.value as T);
  }

  private get label(): string {
    return this.selectedOption?.label || this.placeholderText;
  }

  private get icon(): BitwardenIcon | undefined {
    const selected = this.selectedOption;
    return selected?.icon ?? selected?.iconTile?.icon ?? this.placeholderIcon;
  }

  protected toFormValue(value: T | null) {
    if (value == null) {
      return null;
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("options")) {
      this.childParentMap.clear();
      const root: ChipFilterOption<T> = { children: this.options, value: null };
      this.markParents(root);
      this.rootTree = root;
      if (!this.menuOpen) {
        this.setOrResetRenderedOptions();
      }
    } else if (changed.has("value") && !this.menuOpen) {
      this.setOrResetRenderedOptions();
    }
    super.willUpdate(changed);
  }

  private markParents(tree: ChipFilterOption<T>) {
    tree.children?.forEach((child) => {
      this.childParentMap.set(child, tree);
      this.markParents(child);
    });
  }

  private getParent(option: ChipFilterOption<T>) {
    return this.childParentMap.get(option);
  }

  private findOption(
    tree: ChipFilterOption<T> | null | undefined,
    value: T,
  ): ChipFilterOption<T> | null {
    if (!tree) {
      return null;
    }
    if (tree.value !== null && compareValues(tree.value, value)) {
      return tree;
    }
    for (const child of tree.children ?? []) {
      const found = this.findOption(child, value);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /** Show the submenu that contains the selection, or the selection's own children. */
  private setOrResetRenderedOptions() {
    const selected = this.selectedOption;
    this.renderedOptions = selected
      ? (selected.children?.length ?? 0) > 0
        ? selected
        : this.getParent(selected)
      : this.rootTree;
  }

  private onMenuOpenChange = (open: boolean) => {
    this.menuOpen = open;
    if (open) {
      const chipWidth = this.chipEl?.getBoundingClientRect().width ?? 0;
      const firstItemWidth = this.menu?._items()[0]?.getBoundingClientRect().width ?? 0;
      this.menuWidth = Math.max(chipWidth, firstItemWidth);
    } else {
      this.markAsTouched();
      this.setOrResetRenderedOptions();
      this.menuWidth = null;
    }
  };

  private selectOption(option: ChipFilterOption<T>) {
    this.setValue(option.value);
  }

  /** Navigates into (or back out of) a submenu without closing the menu. */
  private async viewOption(option: ChipFilterOption<T>, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.renderedOptions = option;
    await this.updateComplete;
    await Promise.all(
      this.menu
        ._items()
        .map(
          (item) => (item as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete,
        ),
    );
    this.menu.focusFirstItem();
  }

  private clear() {
    this.renderedOptions = this.rootTree;
    this.setValue(null);
  }

  private renderOption(option: ChipFilterOption<T>) {
    const hasChildren = (option.children?.length ?? 0) > 0;
    const tile = option.iconTile;
    const leading = tile
      ? html`<bit-icon-tile
          slot="start"
          icon=${tile.icon}
          variant=${resolveIconTileVariant(tile, option.disabled)}
          color=${resolveIconTileColor(tile, option.disabled) ?? nothing}
          emphasis=${tile.emphasis ?? "subtle"}
          size="xs"
        ></bit-icon-tile>`
      : option.icon
        ? html`<bit-icon
            slot="start"
            name=${option.icon}
            class=${option.iconClass ?? ""}
          ></bit-icon>`
        : nothing;
    return html`<bit-menu-item
      ?disabled=${!!option.disabled}
      title=${option.label ?? nothing}
      aria-haspopup=${hasChildren ? "menu" : nothing}
      @click=${(event: Event) =>
        hasChildren ? this.viewOption(option, event) : this.selectOption(option)}
    >
      ${leading}${option.label}
      ${hasChildren ? html`<bit-icon slot="end" name="bwi-angle-right"></bit-icon>` : nothing}
    </bit-menu-item>`;
  }

  private renderMenuContent() {
    const rendered = this.renderedOptions;
    if (!rendered) {
      return nothing;
    }
    const parent = this.getParent(rendered);
    const backLabel = parent ? t("backTo", parent.label ?? this.placeholderText) : "";
    const viewLabel = t("viewItemsIn", rendered.label);
    return html`<div
      class="tw-max-h-80 tw-min-w-32 tw-max-w-80 tw-text-sm tw-flex tw-flex-col tw-gap-1"
      style=${this.menuWidth ? `width: ${this.menuWidth}px` : ""}
    >
      ${
        parent
          ? html`<bit-menu-item
                title=${backLabel}
                @click=${(event: Event) => this.viewOption(parent, event)}
              >
                <bit-icon slot="start" name="bwi-angle-left"></bit-icon>
                ${backLabel}
              </bit-menu-item>
              <bit-menu-item title=${viewLabel} @click=${() => this.selectOption(rendered)}>
                <bit-icon slot="start" name="bwi-list"></bit-icon>
                ${viewLabel}
              </bit-menu-item>`
          : nothing
      }
      ${repeat(
        rendered.children ?? [],
        (option) => option,
        (option) => this.renderOption(option),
      )}
    </div>`;
  }

  render() {
    const selected = this.selectedOption;
    const disabled = this.isDisabled;
    const chip = [
      chipClasses({
        variant: "filter",
        size: "large",
        selected: !!selected,
        fullWidth: this.fullWidth,
        hasTrailingIcon: true,
      }),
      "!tw-ps-0",
      "!tw-py-0",
    ].join(" ");
    const endIcon = selected ? undefined : this.menuOpen ? "bwi-angle-up" : "bwi-angle-down";

    const triggerButton = html`<button
      part="trigger"
      type="button"
      class="tw-truncate tw-bg-transparent hover:tw-bg-transparent tw-border-none tw-outline-none tw-w-full tw-min-w-0 tw-text-[color:inherit] tw-text-[length:inherit] -tw-my-px tw-ps-2 tw-py-1 tw-cursor-pointer disabled:tw-cursor-not-allowed"
      ?disabled=${disabled}
      title=${this.label}
      @blur=${this.markTouchedOnBlur}
      ${menuTrigger(this.menu, { onOpenChange: this.onMenuOpenChange })}
    >
      ${renderChipContent(
        html`<span class="tw-block tw-truncate tw-min-w-0">${this.label}</span>`,
        { size: "large", startIcon: this.icon, endIcon },
      )}
    </button>`;

    const dismiss = selected
      ? renderDismissButton({
          label: t("removeItem", this.label),
          disabled,
          onClick: () => this.clear(),
        })
      : nothing;

    return html`
      <span data-chip class=${chip} aria-disabled=${disabled ? "true" : nothing}>
        ${renderChipContent(triggerButton, { size: "large", end: dismiss })}
      </span>
      <bit-menu>${this.renderMenuContent()}</bit-menu>
    `;
  }

  protected firstUpdated(changed: PropertyValues<this>) {
    super.firstUpdated(changed);
    // `menuTrigger` needs the menu element, which only exists after the first render.
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-chip-filter": BitChipFilter;
  }
}
