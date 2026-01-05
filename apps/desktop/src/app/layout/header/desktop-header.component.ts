import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from "@angular/core";
// import { toSignal } from "@angular/core/rxjs-interop";
// import { ActivatedRoute, Data } from "@angular/router";
import { ActivatedRoute } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderComponent, BannerModule } from "@bitwarden/components";

// interface HeaderRouteData extends Data {
//   titleId?: string;
// }

@Component({
  selector: "app-header",
  templateUrl: "./desktop-header.component.html",
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [JslibModule, BannerModule, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopHeaderComponent {
  private route = inject(ActivatedRoute);
  private i18nService = inject(I18nService);

  /**
   * Title to display in header (takes precedence over route data)
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<string>();

  // /**
  //  * Route data as signal with safe defaults
  //  */
  // private readonly routeData = toSignal<Data, RouteDataProperties>(this.route.data, {
  //   initialValue: {},
  // });

  // /**
  //  * Resolved title: prioritizes direct input, falls back to route titleId
  //  */
  protected readonly resolvedTitle = computed(() => {
    // const directTitle = this.title();
    // if (directTitle) {
    //   // console.log("[DesktopHeader] Using direct title:", directTitle);
    //   alert("[DesktopHeader] Using direct title: " + directTitle);
    //   return directTitle;
    // }

    // const data = this.routeData();
    // const titleId = data?.pageTitle?.key;
    // // console.log("[DesktopHeader] Route data:", data, "titleId:", titleId);
    // alert("[DesktopHeader] Route data: " + JSON.stringify(data) + " titleId: " + titleId);

    // const translated = titleId ? this.i18nService.t(titleId) : "";
    // // console.log("[DesktopHeader] Translated title:", translated);
    // alert("[DesktopHeader] Translated title: " + translated);
    return "translated";
  });
}
