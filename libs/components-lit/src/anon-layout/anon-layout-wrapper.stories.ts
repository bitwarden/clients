import { ContextConsumer } from "@lit/context";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, LitElement } from "lit";

import { LockIcon, RegistrationCheckEmailIcon } from "@bitwarden/assets/svg";

import type { AnonLayoutWrapperData } from "./anon-layout-wrapper-data";
import { anonLayoutWrapperDataContext } from "./anon-layout-wrapper-data";
import "./anon-layout-wrapper";
import "../button/button";

export default {
  title: "Component Library/Anon Layout Wrapper",
  component: "bit-anon-layout-wrapper",
  decorators: [(story) => html`<div class="tw-scale-100">${story()}</div>`],
} satisfies Meta;

type Story = StoryObj;

/** The app passes each page's data as `routeData` and slots the page's outlets. */
export const DefaultContentExample: Story = {
  render: () =>
    html`<bit-anon-layout-wrapper
      .routeData=${{ pageIcon: LockIcon } satisfies AnonLayoutWrapperData}
      hostname="storybook.bitwarden.com"
      version="FAKE_APP_VERSION"
    >
      <p>Primary Outlet Example: <br />your primary component goes here</p>
      <p slot="secondary">Secondary Outlet Example: <br />your secondary component goes here</p>
      <p slot="environment-selector">
        Env Selector Outlet Example: <br />your env selector component goes here
      </p>
      <p slot="header-actions">
        Header Actions Outlet Example: <br />your header actions component goes here
      </p>
    </bit-anon-layout-wrapper>`,
};

const initialData: AnonLayoutWrapperData = {
  pageTitle: { key: "setAStrongPassword" },
  pageSubtitle: { key: "finishCreatingYourAccountBySettingAPassword" },
  pageIcon: LockIcon,
};

const changedData: AnonLayoutWrapperData = {
  pageTitle: { key: "enterpriseSingleSignOn" },
  pageSubtitle: "user@email.com (non-translated)",
  pageIcon: RegistrationCheckEmailIcon,
};

/** Story-only page content that overrides the wrapper's data through its data service. */
class DynamicContentElement extends LitElement {
  private readonly service = new ContextConsumer(this, {
    context: anonLayoutWrapperDataContext,
    subscribe: true,
  });
  private initial = true;

  protected createRenderRoot() {
    return this;
  }

  private toggleData() {
    this.service.value?.setAnonLayoutWrapperData(this.initial ? changedData : initialData);
    this.initial = !this.initial;
  }

  render() {
    return html`<bit-button button-type="primary" @click=${this.toggleData}
      >Toggle Data</bit-button
    >`;
  }
}
customElements.define("story-anon-layout-dynamic-content", DynamicContentElement);

/** Content can change the layout's data at runtime via `anonLayoutWrapperDataContext`. */
export const DynamicContentExample: Story = {
  render: () =>
    html`<bit-anon-layout-wrapper
      .routeData=${initialData}
      hostname="storybook.bitwarden.com"
      version="FAKE_APP_VERSION"
    >
      <story-anon-layout-dynamic-content></story-anon-layout-dynamic-content>
    </bit-anon-layout-wrapper>`,
};
