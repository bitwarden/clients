import { Injectable, inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  RouterStateSnapshot,
  UrlSerializer,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  POPUP_RESUME_ROUTE_MEMORY,
} from "@bitwarden/common/platform/state";

const POPUP_RESUME_ROUTE_KEY = new KeyDefinition<string>(
  POPUP_RESUME_ROUTE_MEMORY,
  "popupResumeRoute",
  {
    deserializer: (obj) => obj,
  },
);

@Injectable({ providedIn: "root" })
class ResumePopupService {
  private popupResumeRouteState = inject(GlobalStateProvider).get(POPUP_RESUME_ROUTE_KEY);
  private hasResumed = false;

  async storeLatestUrl(url: string) {
    await this.popupResumeRouteState.update(() => url);
  }

  /**
   *
   * @returns the `UrlTree` that should be redirected to. If no redirect should occur, `null` is returned instead.
   **/
  async getStoredUrl(): Promise<string> {
    if (this.hasResumed) {
      return null;
    }
    const url = await firstValueFrom(this.popupResumeRouteState.state$);
    if (!url) {
      return null;
    }
    this.hasResumed = true;
    await this.popupResumeRouteState.update(() => url);
    return url;
  }
}

export const resumePopupGuard: CanActivateChildFn = async (
  _childRoute: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const resumePopupService = inject(ResumePopupService);

  const url = await resumePopupService.getStoredUrl();

  /** On each route change, store the current URL in state */
  await resumePopupService.storeLatestUrl(state.url);

  /** Continue with original navigation if no URL is stored */
  if (!url) {
    return true;
  }

  /** Redirect to stored URL */
  return inject(UrlSerializer).parse(url);
};
