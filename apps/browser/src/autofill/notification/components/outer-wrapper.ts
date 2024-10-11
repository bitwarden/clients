import { html, css } from "lit";

import { NotificationBarIframeInitData } from "../abstractions/notification-bar";

import { CloseButton } from "./close-button";
import { NotificationMessage } from "./message";

export function OuterWrapper({
  handleCloseNotification,
  i18n,
  isVaultLocked,
  theme,
}: { handleCloseNotification: (e: Event) => void } & {
  i18n: { [key: string]: string };
} & NotificationBarIframeInitData) {
  const logoURI = isVaultLocked
    ? chrome.runtime.getURL("images/icon38_locked.png")
    : chrome.runtime.getURL("images/icon38.png");

  return html`
    <div style=${wrapperStyles} id="notification-bar-outer-wrapper" class="outer-wrapper">
      <a href="https://vault.bitwarden.com" target="_blank" id="logo-link" rel="noreferrer">
        <img style=${logoStyles} alt="Bitwarden" src=${logoURI} />
      </a>
      ${NotificationMessage({ message: "Hello Whirled!" })}
      ${CloseButton({ theme, handleCloseNotification })}
    </div>
  `;
}

const wrapperStyles = css`
  display: flex;
  position: absolute;
  right: 20px;
  justify-content: space-between;
  width: 400px;
`;

const logoStyles = css`
  display: block;
  width: 24px;
  height: 24px;
`;
