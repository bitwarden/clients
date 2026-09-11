import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, ValidatorFn } from "@angular/forms";
import { map, ReplaySubject, skip, Subject, switchAll, takeUntil, withLatestFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { VendorId } from "@bitwarden/common/tools/extension";
import {
  FormFieldModule,
  AriaDisableDirective,
  TooltipDirective,
  BitIconButtonComponent,
  CheckboxModule,
} from "@bitwarden/components";
import {
  CredentialGeneratorService,
  ForwarderOptions,
  GeneratorMetadata,
} from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { urlSafetyValidator } from "./forwarder-base-url.validator";

const Controls = Object.freeze({
  domain: "domain",
  token: "token",
  baseUrl: "baseUrl",
  prefix: "prefix",
  allowUnsafeUrl: "allowUnsafeUrl",
});

/** Options group for forwarder integrations */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-forwarder-settings",
  templateUrl: "forwarder-settings.component.html",
  imports: [
    ReactiveFormsModule,
    FormFieldModule,
    AriaDisableDirective,
    TooltipDirective,
    BitIconButtonComponent,
    CheckboxModule,
    JslibModule,
    I18nPipe,
  ],
})
export class ForwarderSettingsComponent implements OnInit, OnChanges, OnDestroy {
  /** Instantiates the component
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
    private i18nService: I18nService,
  ) {}

  /** Binds the component to a specific user's settings.
   *  @remarks this is initialized to null but since it's a required input it'll
   *     never have that value in practice.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  account: Account = null!;

  protected account$ = new ReplaySubject<Account>(1);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  forwarder: VendorId = null!;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings$(...)` instead.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onUpdated = new EventEmitter<unknown>();

  // shared by the declarative validator below and the imperative refresh below, so both agree
  private readonly baseUrlValidator: ValidatorFn = urlSafetyValidator(
    this.i18nService,
    (): boolean => this.isAllowUnsafeUrlChecked(),
  );

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    [Controls.domain]: [""],
    [Controls.token]: [""],
    [Controls.baseUrl]: ["", [this.baseUrlValidator]],
    [Controls.prefix]: [false],
    [Controls.allowUnsafeUrl]: [false],
  });

  private isAllowUnsafeUrlChecked(): boolean {
    return !!this.settings.get(Controls.allowUnsafeUrl)?.value;
  }

  /** Re-runs the baseUrl validator and applies its result directly, emitting only a status
   *  change — not a value change — so it can be called from a valueChanges subscriber on
   *  either baseUrl or allowUnsafeUrl without recursing into that same subscriber.
   */
  private refreshBaseUrlValidity(): void {
    const baseUrlControl = this.settings.get(Controls.baseUrl);
    if (!baseUrlControl) {
      return;
    }

    const result = baseUrlControl.enabled ? this.baseUrlValidator(baseUrlControl) : null;
    baseUrlControl.setErrors(result);
    if (result) {
      // surfaces a rejection immediately rather than waiting for the user to touch the field —
      // relevant when a previously-saved value fails a check introduced after it was stored
      baseUrlControl.markAsTouched({ onlySelf: true });
    }
  }

  private vendor = new ReplaySubject<VendorId>(1);

  async ngOnInit() {
    const forwarder$ = new ReplaySubject<GeneratorMetadata<ForwarderOptions>>(1);
    this.vendor
      .pipe(
        map((vendor) => this.generatorService.forwarder(vendor)),
        takeUntil(this.destroyed$),
      )
      .subscribe((forwarder) => {
        this.displayDomain = forwarder.capabilities.fields.includes("domain");
        this.displayToken = forwarder.capabilities.fields.includes("token");
        this.displayBaseUrl = forwarder.capabilities.fields.includes("baseUrl");
        this.displayPrefix = forwarder.capabilities.fields.includes("prefix");

        forwarder$.next(forwarder);
      });

    const settings$ = forwarder$.pipe(
      map((forwarder) => this.generatorService.settings(forwarder, { account$: this.account$ })),
    );

    // bind settings to the reactive form
    settings$.pipe(switchAll(), takeUntil(this.destroyed$)).subscribe((settings) => {
      // skips reactive event emissions to break a subscription cycle
      // convert prefix sentinel string to boolean for the checkbox control
      const patchValues = {
        ...(settings as any),
        prefix: (settings as any).prefix === "website",
        // the disclaimer checkbox reflects approval of the *current* baseUrl only
        allowUnsafeUrl:
          !!(settings as any).baseUrl &&
          (settings as any).allowUnsafeUrlFor === (settings as any).baseUrl,
      };
      this.settings.patchValue(patchValues, { emitEvent: false });
      // patchValue validates baseUrl before allowUnsafeUrl above it is applied, so its
      // validity has to be recomputed once the whole group reflects the loaded settings
      this.refreshBaseUrlValidity();
    });

    // enable requested forwarder inputs
    forwarder$.pipe(takeUntil(this.destroyed$)).subscribe((forwarder) => {
      for (const name in Controls) {
        const control = this.settings.get(name);
        if (forwarder.capabilities.fields.includes(name)) {
          control?.enable({ emitEvent: false });
        } else {
          control?.disable({ emitEvent: false });
        }
      }

      // the disclaimer checkbox isn't a forwarder api field; it's gated by baseUrl support.
      const allowUnsafeUrlControl = this.settings.get(Controls.allowUnsafeUrl);
      if (forwarder.capabilities.fields.includes(Controls.baseUrl)) {
        allowUnsafeUrlControl?.enable({ emitEvent: false });
      } else {
        allowUnsafeUrlControl?.disable({ emitEvent: false });
      }
    });

    // editing the url invalidates any prior approval of it
    this.settings
      .get(Controls.baseUrl)
      ?.valueChanges.pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        const allowUnsafeUrlControl = this.settings.get(Controls.allowUnsafeUrl);
        if (allowUnsafeUrlControl?.value) {
          allowUnsafeUrlControl.setValue(false, { emitEvent: false });
        }
        this.refreshBaseUrlValidity();
      });

    // (un)checking the disclaimer immediately reflects on the url field's validity
    this.settings
      .get(Controls.allowUnsafeUrl)
      ?.valueChanges.pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.refreshBaseUrlValidity());

    // the first emission is the current value; subsequent emissions are updates
    settings$
      .pipe(
        map((settings$) => settings$.pipe(skip(1))),
        switchAll(),
        takeUntil(this.destroyed$),
      )
      .subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    // (a rejected baseUrl is still persisted as typed — IntegrationContext.baseUrl() is the
    // actual enforcement point at generation time regardless of what's stored here, and
    // gating persistence on form validity would also block saving edits to every other field)
    this.saveSettings
      .pipe(withLatestFrom(this.settings.valueChanges, settings$), takeUntil(this.destroyed$))
      .subscribe(([, value, settings]) => {
        // convert prefix boolean back to sentinel string for the settings store, and the
        // disclaimer checkbox into the url it was checked for (or clear it, if unchecked)
        const { allowUnsafeUrl, ...rest } = value as any;
        const saveValues = {
          ...rest,
          prefix: (value as any).prefix ? "website" : "",
          allowUnsafeUrlFor: allowUnsafeUrl ? (value as any).baseUrl : "",
        };
        settings.next(saveValues as ForwarderOptions);
      });
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  async ngOnChanges(changes: SimpleChanges) {
    this.refresh$.complete();
    if ("forwarder" in changes) {
      this.vendor.next(this.forwarder);
    }

    if ("account" in changes) {
      this.account$.next(this.account);
    }
  }

  protected displayDomain: boolean = false;
  protected displayToken: boolean = false;
  protected displayBaseUrl: boolean = false;
  protected displayPrefix: boolean = false;

  private readonly refresh$ = new Subject<void>();

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
