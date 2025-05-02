import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { ActionButton } from "../../buttons/action-button";
import "../presentational/notification";

export function GenericNotification() {
  const header = "Header text";
  const body = "Body text";
  const footer = html`${ActionButton({
    buttonText: "Button Text",
    theme: ThemeTypes.Light,
    handleClick: () => {},
  })}`;

  return html`<presentational-notification>
    <div slot="header">${header}</div>
    <div slot="body">${body}</div>
    <div slot="footer">${footer}</div>
  </presentational-notification>`;
}
