import { Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Injectable()
export class RouterService {
  private previousUrl: string = undefined;
  private currentUrl: string = undefined;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private titleService: Title,
    i18nService: I18nService
  ) {
    this.currentUrl = this.router.url;

    router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.url;

        let title = i18nService.t("bitWebVault");

        if (this.currentUrl.includes("/sm/")) {
          title = i18nService.t("bitSecretsManager");
        }

        let child = this.activatedRoute.firstChild;
        while (child.firstChild) {
          child = child.firstChild;
        }

        const titleId: string = child?.snapshot?.data?.titleId;
        const rawTitle: string = child?.snapshot?.data?.title;
        const updateUrl = !child?.snapshot?.data?.doNotSaveUrl ?? true;

        if (titleId != null || rawTitle != null) {
          const newTitle = rawTitle != null ? rawTitle : i18nService.t(titleId);
          if (newTitle != null && newTitle !== "") {
            title = newTitle + " | " + title;
          }
        }
        this.titleService.setTitle(title);
        if (updateUrl) {
          this.setPreviousUrl(this.currentUrl);
        }
      });
  }

  getPreviousUrl() {
    return this.previousUrl;
  }

  setPreviousUrl(url: string) {
    this.previousUrl = url;
  }
}
