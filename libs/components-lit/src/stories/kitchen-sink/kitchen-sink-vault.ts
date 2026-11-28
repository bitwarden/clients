import { html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { typography } from "../../typography/typography";
import "../../button/button";
import "../../button-group/button-group";
import "../../menu/menu";
import "../../menu/menu-item";
import "../../section/section";

import {
  openKitchenSinkDialog,
  openKitchenSinkDialogWithAutofocus,
  openKitchenSinkDrawer,
  openKitchenSinkSimpleDialog,
} from "./kitchen-sink-dialogs";
import { KitchenSinkElement } from "./kitchen-sink-element";
import "./kitchen-sink-form";
import "./kitchen-sink-table";
import "./kitchen-sink-toggle-list";

const heading = `${typography("h2", { noMargin: true })} tw-mb-6`;

/** @internal Stories only. */
@customElement("bit-kitchen-sink-vault")
export class KitchenSinkVault extends KitchenSinkElement {
  /** Renders the pre-VFO1 table. */
  @property({ type: Boolean }) legacy = false;

  render() {
    const dialogButtonId = `${this.uid}-open-dialog`;
    const menuButtonId = `${this.uid}-focus-menu`;
    const formSectionId = `${this.uid}-form-section`;
    return html`
      <bit-section>
        <h2 class=${heading}>Table Example</h2>
        ${
          this.legacy
            ? html`<bit-kitchen-sink-table></bit-kitchen-sink-table>`
            : html`<bit-kitchen-sink-table-v2></bit-kitchen-sink-table-v2>`
        }

        <bit-button-group class="tw-mt-4" orientation="auto">
          <bit-button id=${dialogButtonId} @click=${openKitchenSinkDialog}>Open Dialog</bit-button>
          <bit-button @click=${openKitchenSinkDrawer}>Open Drawer</bit-button>
          <bit-button id=${menuButtonId}>Open Dialog from Menu</bit-button>
          <bit-button @click=${() => this.tour.start()}>Start Tour</bit-button>
        </bit-button-group>
        <bit-menu trigger=${menuButtonId}>
          <bit-menu-item @click=${openKitchenSinkDialog}>Open Dialog</bit-menu-item>
          <bit-menu-item @click=${openKitchenSinkDialogWithAutofocus}>
            Open Dialog with Autofocus
          </bit-menu-item>
          <bit-menu-item @click=${openKitchenSinkSimpleDialog}>Open Simple Dialog</bit-menu-item>
        </bit-menu>
      </bit-section>
      <bit-section>
        <h2 class=${heading}>Companies using Bitwarden</h2>
        <bit-kitchen-sink-toggle-list></bit-kitchen-sink-toggle-list>
      </bit-section>
      <bit-section id=${formSectionId}>
        <h2 class=${heading}>Survey Form</h2>
        <bit-kitchen-sink-form></bit-kitchen-sink-form>
      </bit-section>

      ${this.tourPopover({
        step: 2,
        anchor: dialogButtonId,
        heading: "Step 2: Dialogs",
        position: "below-start",
        body: html`<div>
            Click buttons to <strong>open dialogs</strong> for important actions and forms.
          </div>
          <p class="tw-mt-2 tw-mb-0">
            Dialogs help focus user attention and collect input for critical operations.
          </p>`,
      })}
      ${this.tourPopover({
        step: 3,
        anchor: formSectionId,
        heading: "Step 3: Forms",
        position: "right-center",
        body: html`<div>
            Fill out <strong>forms</strong> to collect and manage user information.
          </div>
          <p class="tw-mt-2 tw-mb-0">
            Our form components provide consistent styling and validation patterns.
          </p>`,
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-vault": KitchenSinkVault;
  }
}
