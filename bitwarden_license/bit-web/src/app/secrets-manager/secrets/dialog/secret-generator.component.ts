import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  ButtonModule,
  CheckboxModule,
  ColorPasswordModule,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";
import { PasswordGeneratorRequest } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

const SETTINGS_WAIT_MS = 100;

@Component({
  selector: "sm-secret-generator",
  templateUrl: "./secret-generator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    CheckboxModule,
    ColorPasswordModule,
    I18nPipe,
  ],
})
export class SecretGeneratorComponent implements OnInit {
  readonly valueGenerated = output<string>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly sdkService = inject(SdkService);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly settingsForm = this.formBuilder.group({
    length: [14],
    uppercase: [true],
    lowercase: [true],
    number: [true],
    special: [false],
    avoidAmbiguous: [false],
  });

  protected readonly lengthMin = 5;
  protected readonly lengthMax = 128;
  protected readonly isOpen = signal(false);
  protected readonly preview = signal("");

  // Monotonically increasing token so an in-flight generation can be superseded: only the most
  // recent request writes the preview, preventing a stale value when settings change mid-generation.
  private readonly latestRequest = signal(0);

  protected get canGenerate(): boolean {
    const { uppercase, lowercase, number, special } = this.settingsForm.value;
    return !!(uppercase || lowercase || number || special);
  }

  ngOnInit() {
    // Regenerate as settings change while the panel is open.
    this.settingsForm.valueChanges
      .pipe(debounceTime(SETTINGS_WAIT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isOpen() && this.canGenerate) {
          void this.generate();
        }
      });
  }

  protected toggle() {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      void this.generate();
    }
  }

  protected async generate() {
    const request = this.latestRequest() + 1;
    this.latestRequest.set(request);
    try {
      const client = await firstValueFrom(this.sdkService.client$);
      const password = await client.generator().password(this.buildRequest());
      if (request === this.latestRequest()) {
        this.preview.set(password);
      }
    } catch (e: unknown) {
      this.logService.error(e);
      if (request === this.latestRequest()) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
      }
    }
  }

  protected useValue() {
    this.valueGenerated.emit(this.preview());
    this.isOpen.set(false);
  }

  // Zero each minX when its character type is unchecked so the SDK doesn't re-add the type.
  private buildRequest(): PasswordGeneratorRequest {
    const value = this.settingsForm.value;
    const uppercase = value.uppercase ?? false;
    const lowercase = value.lowercase ?? false;
    const number = value.number ?? false;
    const special = value.special ?? false;
    return {
      length: Number(value.length),
      lowercase,
      uppercase,
      numbers: number,
      special,
      avoidAmbiguous: value.avoidAmbiguous ?? false,
      minLowercase: lowercase ? 1 : 0,
      minUppercase: uppercase ? 1 : 0,
      minNumber: number ? 1 : 0,
      minSpecial: special ? 1 : 0,
    };
  }
}
