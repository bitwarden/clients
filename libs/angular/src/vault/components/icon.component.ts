import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";
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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { buildCipherIcon, CipherIconDetails } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

@Component({
  selector: "app-vault-icon",
  templateUrl: "icon.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
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

  /**
   * Optional custom size for the icon in pixels.
   * When provided, forces explicit dimensions on the icon wrapper to prevent layout collapse at different zoom levels.
   * If not provided, the wrapper has no explicit dimensions and relies on CSS classes (tw-size-6/24px for images).
   * This can cause the wrapper to collapse when images are loading/hidden, especially at high browser zoom levels.
   * Reference: default image size is tw-size-6 (24px), coloredIcon uses 36px.
   */
  readonly size = input<number>();

  readonly imageLoaded = signal(false);

  /**
   * Computed style object for icon dimensions.
   * Centralizes the sizing logic to avoid repetition in the template.
   */
  protected readonly iconStyle = computed(() => {
    if (this.coloredIcon()) {
      return { width: "36px", height: "36px" };
    }
    const size = this.size();
    if (size) {
      return { width: size + "px", height: size + "px" };
    }
    return {};
  });

  protected readonly data$: Observable<CipherIconDetails>;

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly domainSettingsService: DomainSettingsService,
    private readonly configService: ConfigService,
  ) {
    const iconSettings$ = combineLatest([
      this.environmentService.environment$.pipe(map((e) => e.getIconsUrl())),
      this.domainSettingsService.showFavicons$.pipe(distinctUntilChanged()),
    ]).pipe(
      map(([iconsUrl, showFavicon]) => ({ iconsUrl, showFavicon })),
      startWith({ iconsUrl: null, showFavicon: false }), // Start with a safe default to avoid flickering icons
      distinctUntilChanged(),
    );

    const newItemTypes$ = this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes);

    this.data$ = combineLatest([iconSettings$, toObservable(this.cipher), newItemTypes$]).pipe(
      map(([{ iconsUrl, showFavicon }, cipher, newItemTypes]) =>
        buildCipherIcon(iconsUrl, cipher, showFavicon, newItemTypes),
      ),
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
