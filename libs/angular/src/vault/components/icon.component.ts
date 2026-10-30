import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
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
import { LogService, Measurement, PerfTrackGroup } from "@bitwarden/logging";

const PERF_TRACK = "Icons";
const PERF_ENTRY = "Load icon";

/**
 * Size of the image the icons server answers with, as HTTP 200, when it has no icon for a
 * domain: a 19x19 globe PNG. Its size is the only signal, as the response itself is opaque.
 */
const NOT_FOUND_ICON_SIZE = 19;

const IconLoadResult = Object.freeze({
  Loaded: "loaded",
  NotFound: "not found",
  Error: "error",
} as const);
type IconLoadResult = (typeof IconLoadResult)[keyof typeof IconLoadResult];

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

  private readonly logService = inject(LogService);

  /** Running from when the image URL is bound until the image loads or fails. */
  private readonly loadMeasurement = signal<Measurement | null>(null);

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
          this.startLoad(next);
        }
      }),
      map(([_, next]) => next!),
    );
  }

  protected onImageLoad(event: Event) {
    // Keep the server's low resolution placeholder hidden, so the glyph shows instead
    const { naturalWidth, naturalHeight } = event.target as HTMLImageElement;
    if (naturalWidth === NOT_FOUND_ICON_SIZE && naturalHeight === NOT_FOUND_ICON_SIZE) {
      this.imageLoaded.set(false);
      this.finishLoad(IconLoadResult.NotFound);
      return;
    }

    this.imageLoaded.set(true);
    this.finishLoad(IconLoadResult.Loaded);
  }

  protected onImageError() {
    this.imageLoaded.set(false);
    this.finishLoad(IconLoadResult.Error);
  }

  /**
   * Starts a DevTools entry under Performance > "Vault" > "Icons" for an image about to load.
   * The URL is left out, since the hostname is vault data.
   */
  private startLoad(next: CipherIconDetails | null) {
    if (!next?.imageEnabled || !next.image) {
      this.loadMeasurement.set(null);
      return;
    }

    this.loadMeasurement.set(
      this.logService.startMeasurement(PerfTrackGroup.Vault, PERF_TRACK, PERF_ENTRY),
    );
  }

  private finishLoad(result: IconLoadResult) {
    this.loadMeasurement()?.finish([["Result", result]]);
    this.loadMeasurement.set(null);
  }
}
