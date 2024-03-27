import { Observable, firstValueFrom } from "rxjs";

import { ActiveUserState, StateProvider } from "@bitwarden/common/platform/state";

import { BrowserComponentState } from "../../../models/browserComponentState";
import { BrowserSendComponentState } from "../../../models/browserSendComponentState";

import { BROWSER_SEND_COMPONENT, BROWSER_SEND_TYPE_COMPONENT } from "./key-definitions";

/** Get or set the active user's component state for the Send browser component
 */
export class BrowserSendStateService {
  /** Observable that contains the current state for active user Sends including the send data and type counts
   *  along with the search text and scroll position
   */
  browserSendComponentState$: Observable<BrowserSendComponentState>;

  /** Observable that contains the  current state for active user Sends that only includes the search text
   *  and scroll position
   */
  browserSendTypeComponentState$: Observable<BrowserComponentState>;

  private activeUserBrowserSendComponentState: ActiveUserState<BrowserSendComponentState>;
  private activeUserBrowserSendTypeComponentState: ActiveUserState<BrowserComponentState>;

  constructor(protected stateProvider: StateProvider) {
    this.activeUserBrowserSendComponentState = this.stateProvider.getActive(BROWSER_SEND_COMPONENT);
    this.browserSendComponentState$ = this.activeUserBrowserSendComponentState.state$;

    this.activeUserBrowserSendTypeComponentState = this.stateProvider.getActive(
      BROWSER_SEND_TYPE_COMPONENT,
    );
    this.browserSendTypeComponentState$ = this.activeUserBrowserSendTypeComponentState.state$;
  }

  /** Get the active user's browser send component state
   *  @returns { BrowserSendComponentState } contains the sends and type counts along with the scroll position and search text for the
   *  send component on the browser
   */
  async getBrowserSendComponentState(): Promise<BrowserSendComponentState> {
    return await firstValueFrom(this.browserSendComponentState$);
  }

  /** Set the active user's browser send component state
   *  @param { BrowserSendComponentState } value sets the sends and type counts along with the scroll position and search text for
   *  the send component on the browser
   */
  async setBrowserSendComponentState(value: BrowserSendComponentState): Promise<void> {
    await this.activeUserBrowserSendComponentState.update(() => value);
  }

  /** Get the active user's browser component state
   *  @returns { BrowserComponentState } contains the scroll position and search text for the sends menu on the browser
   */
  async getBrowserSendTypeComponentState(): Promise<BrowserComponentState> {
    return await firstValueFrom(this.browserSendTypeComponentState$);
  }

  /** Set the active user's browser component state
   *  @param { BrowserComponentState } value set the scroll position and search text for the send component on the browser
   */
  async setBrowserSendTypeComponentState(value: BrowserComponentState): Promise<void> {
    await this.activeUserBrowserSendTypeComponentState.update(() => value);
  }
}
