# Autofill Chrome dependencies

## E1 dependency inventory

The inventory covers `services/autofill.service.ts` and its public abstraction in
`services/abstractions/autofill.service.ts` for issue #5.

| Entry point or data type                                                                      | Destination data consumed                                                     | Browser dependency                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `collectPageDetailsFromTab$`                                                                  | `id` scopes response messages, `url` controls immediate fallback              | `BrowserApi.tabSendMessage` sends the collection command. `MessageListener` and `getWebExtSender` supply responses and frame identity. |
| `AutoFillOptions` and `doAutoFill`                                                            | `id` and `url` validate page details and route the fill                       | `BrowserApi.tabSendMessage` dispatches `fillForm` or `triggerAutoSubmitLogin` to each collected frame.                                 |
| `PageDetail` and `CollectPageDetailsResponseMessage`                                          | `tab.id`, `tab.url`, and a separate `frameId`                                 | Browser response records carry `chrome.tabs.Tab`. Frame identity comes from trusted sender metadata.                                   |
| `doAutoFillOnTab`                                                                             | `url` selects a cipher, the tab is forwarded to password reprompt and filling | Password reprompt opens an extension popout with the browser tab context.                                                              |
| `isPasswordRepromptRequired`                                                                  | Forwards the tab to `openVaultItemPasswordRepromptPopout`                     | Popout utilities consume browser window context and send a browser message.                                                            |
| `doAutoFillActiveTab` and `getActiveTab`                                                      | Active tab identity and URL                                                   | `BrowserApi.getTabFromCurrentWindow` discovers the current browser destination.                                                        |
| `injectAutofillScripts`                                                                       | `id` identifies the injection destination                                     | `ScriptInjectorService` handles browser script injection and manifest-specific configuration.                                          |
| `loadAutofillScriptsOnInstall`, `reloadAutofillScripts`, and `injectAutofillScriptsInAllTabs` | Tab IDs, URLs, and live frame IDs                                             | `BrowserApi.tabsQuery` and `getAllFrameDetails` enumerate browser destinations before injection.                                       |

Script generation consumes `AutofillPageDetails` and `GenerateFillScriptOptions`, including
`tabUrl`. Its destination input is already a URL string. DOM document access, extension protocols,
and browser messaging remain additional platform dependencies in the surrounding service.

## E2 FillTarget

### Alignment with shared platform contracts

The integration baseline is `ba5608345e`, which adds the platform contract adapters
documented in `docs/platform-contracts.md` and ADR-0001. Those contracts currently cover storage
and capability status; they explicitly leave autofill outside their scope. `FillTarget` is a
destination data type, not a runtime contract or capability, and requires no bootstrap registration.
The existing browser service and messaging adapter remain responsible for collection and filling.
The updated orchestrator's live-tab validation accepts the same destination type and still obtains
the full live browser tab through `BrowserApi`, preserving its foreground and navigation checks.
Any future shared autofill runtime contract should follow ADR-0001 and provide its own shared
behavioral suite and client adapters.

The collection regression tests pass a plain `FillTarget` for frame zero and a destination with
no ID. Responses still use browser-authoritative sender metadata and browser tab records. This
checks compatibility with the narrowed input without claiming browser-independent execution.

The shared `FillTarget` interface lives in
`libs/common/src/autofill/types/fill-target.ts`. It declares optional numeric `id` and string `url`
fields. These fields describe the destination needed by collection and filling. Existing Chrome tabs
are structurally compatible, and callers can also supply a plain object with those fields.

`collectPageDetailsFromTab$` and `AutoFillOptions.tab` now accept `FillTarget`.
`BrowserApi.tabSendMessage` accepts the browser ID subset that it reads. Its implementation continues
to translate that ID into a Chrome messaging call. Browser response records, tab discovery, injection,
and reprompt APIs retain their browser contracts.

Both fields are optional to preserve existing handling of unavailable destinations. Collection emits
an empty result immediately for a missing URL or extension URL, replays messaging failure to late
subscribers, and falls back after one second of silence. Filling returns `AutofillOutcome.Denied` when
the destination URL is absent. Frame IDs remain separate, including valid frame zero and the
collection convention that an omitted frame ID targets every frame.

The fill regression test supplies a plain destination and verifies that browser messaging dispatches
the generated fill script to the collected frame.
