import { html, css } from "lit";

export function BrandIcon({ isVaultLocked }: { isVaultLocked: boolean }) {
  const iconLink = "https://vault.bitwarden.com";
  const iconImageURI = isVaultLocked
    ? chrome.runtime.getURL("images/icon38_locked.png")
    : chrome.runtime.getURL("images/icon38.png");

  // @TODO localize `alt` and other attributes
  const Icon = html`<img style=${iconStyles} alt="Bitwarden" src=${iconImageURI} />`;

  return iconLink ? html`<a href="${iconLink}" target="_blank" rel="noreferrer">${Icon}</a>` : Icon;
}

const iconStyles = css`
  display: block;
  width: 24px;
  height: 24px;
`;
