import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  tap,
  Observable,
  startWith,
  pairwise,
} from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { buildCipherIcon, CipherIconDetails } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

@Component({
  selector: "app-vault-icon",
  templateUrl: "icon.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class IconComponent {
  /**
   * The cipher to display the icon for.
   */
  readonly cipher = input.required<CipherViewLike>();

  /**
   * coloredIcon will adjust the size of favicons and the colors of the text icon when user is in the item details view.
   */
  readonly coloredIcon = input<boolean>(false);

  readonly imageLoaded = signal(false);

  protected data$: Observable<CipherIconDetails>;

  constructor(
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
  ) {
    const iconSettings$ = combineLatest([
      this.environmentService.environment$.pipe(map((e) => e.getIconsUrl())),
      this.domainSettingsService.showFavicons$.pipe(distinctUntilChanged()),
    ]).pipe(
      map(([iconsUrl, showFavicon]) => ({ iconsUrl, showFavicon })),
      startWith({ iconsUrl: null, showFavicon: false }), // Start with a safe default to avoid flickering icons
      distinctUntilChanged(),
    );

    this.data$ = combineLatest([iconSettings$, toObservable(this.cipher)]).pipe(
      map(([{ iconsUrl, showFavicon }, cipher]) => buildCipherIcon(iconsUrl, cipher, showFavicon)),
      startWith(null),
      pairwise(),
      tap(([prev, next]) => {
        if (prev?.image !== next?.image) {
          // The image changed, reset the loaded state to not show an empty icon
          this.imageLoaded.set(false);
        }
      }),
      map(([_, next]) => next!),
    );
  }
}
