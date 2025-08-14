import { html } from "lit";

export type ExampleComponentProps = {
  message: string;
};

export function ExampleComponent({ message }: ExampleComponentProps) {
  return html`<div>${message}</div>`;
}
// import { PresentationalNotificationBody } from "../presentational/body";
// import { PresentationalNotificationHeader } from "../presentational/header";
// <div>${PresentationalNotificationBody({ content: body.content, icon: body?.icon })}</div>
// <div>${PresentationalNotificationHeader({ message: title })}</div>
