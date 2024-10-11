import { html, css } from "lit";

export function NotificationMessage({ message }: { message: string }) {
  return html` <div style=${messageStyles}>${message}</div> `;
}

const messageStyles = css`
  background-color: hotpink;
  color: lime;
`;
