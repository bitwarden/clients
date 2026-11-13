import { CSSResultGroup, LitElement } from "lit";

import { sharedStyles } from "../styles/shared-styles";

import "./context-root";

/** Base class for library elements. Adopts the shared Tailwind sheet into the shadow root. */
export class BitElement extends LitElement {
  static styles: CSSResultGroup = [sharedStyles];
}
