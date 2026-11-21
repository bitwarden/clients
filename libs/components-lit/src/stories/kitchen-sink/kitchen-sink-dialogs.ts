import { html } from "lit";

import type { DialogRef } from "../../dialog/dialog-ref";
import { openDialog, openSimpleDialog } from "../../dialog/dialog-service";
import { openDrawer } from "../../dialog/drawer";
import { typography } from "../../typography/typography";
import "../../button/button";
import "../../dialog/dialog";
import "../../input/input";

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

const paragraph = () => html`<p class=${typography("body1")}>${lorem}</p>`;

const kitchenSinkDialog = (ref: DialogRef) =>
  html`<bit-dialog heading="Dialog Title" dialog-size="small">
    ${paragraph()}
    <bit-input label="What did foo say to bar?" value="Baz"></bit-input>
    ${Array.from({ length: 6 }, paragraph)}
    <bit-button slot="footer" button-type="primary" @click=${() => ref.close()}>OK</bit-button>
    <bit-button slot="footer" button-type="secondary" data-bit-dialog-close>Cancel</bit-button>
  </bit-dialog>`;

const kitchenSinkDialogWithAutofocus = (ref: DialogRef) =>
  html`<bit-dialog heading="Dialog Title" dialog-size="small">
    <bit-input label="Username" autofocus></bit-input>
    <bit-button slot="footer" button-type="primary" @click=${() => ref.close()}>Save</bit-button>
    <bit-button slot="footer" button-type="secondary" data-bit-dialog-close>Cancel</bit-button>
  </bit-dialog>`;

/** @internal Stories only. */
export function openKitchenSinkDialog() {
  openDialog(kitchenSinkDialog);
}

/** @internal Stories only. */
export function openKitchenSinkDrawer() {
  void openDrawer(kitchenSinkDialog);
}

/** @internal Stories only. */
export function openKitchenSinkDialogWithAutofocus() {
  openDialog(kitchenSinkDialogWithAutofocus);
}

/** @internal Stories only. */
export function openKitchenSinkSimpleDialog() {
  void openSimpleDialog({
    title: "Confirm Action",
    content: "Are you sure you want to proceed?",
    type: "primary",
    acceptButtonText: "Yes",
    cancelButtonText: "No",
  });
}
