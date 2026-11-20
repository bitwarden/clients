import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  viewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, ValidatorFn } from "@angular/forms";
import {
  map,
  ReplaySubject,
  skip,
  Subject,
  switchAll,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { VendorId } from "@bitwarden/common/tools/extension";
import { unsafeUrlReason } from "@bitwarden/common/tools/url-safety";
import {
  FormFieldModule,
  AriaDisableDirective,
  TooltipDirective,
  BitIconButtonComponent,
  CheckboxModule,
  DialogService,
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
   *  @param dialogService prompts the user to confirm an unsafe self-hosted url
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
    private i18nService: I18nService,
    private dialogService: DialogService,
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

  private trustedUrl: string | null = null;

  private readonly baseUrlValidator: ValidatorFn = urlSafetyValidator(this.i18nService);

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    [Controls.domain]: [""],
    [Controls.token]: [""],
    [Controls.baseUrl]: ["", [this.baseUrlValidator]],
    [Controls.prefix]: [false],
  });

  protected readonly baseUrlInput = viewChild<ElementRef<HTMLInputElement>>("baseUrlInput");

  protected get showTrustedHint(): boolean {
    const value = (this.settings.get(Controls.baseUrl)?.value as string) ?? "";
    if (!value || this.trustedUrl !== value) {
      return false;
    }
    const reason = unsafeUrlReason(value);
    return !!reason && reason.code !== "invalid";
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
    settings$
      .pipe(
        switchMap((subject) => subject.pipe(map((value) => ({ subject, value })))),
        takeUntil(this.destroyed$),
      )
      .subscribe(({ subject, value }) => {
        // grandfather: a base url already saved before this check existed is trusted as-is,
        // for the hint display and for what gets persisted as allowUnsafeUrlFor
        const baseUrl = ((value as any).baseUrl as string) || null;
        this.trustedUrl = baseUrl;

        // skips reactive event emissions to break a subscription cycle
        // convert prefix sentinel string to boolean for the checkbox control
        const patchValues = {
          ...(value as any),
          prefix: (value as any).prefix === "website",
        };
        this.settings.patchValue(patchValues, { emitEvent: false });

        // a malformed stored value is the only thing the validator still rejects — mark it
        // touched so the error is visible immediately rather than only once the user happens
        // to touch the field
        const baseUrlControl = this.settings.get(Controls.baseUrl);
        if (baseUrlControl?.invalid) {
          baseUrlControl.markAsTouched({ onlySelf: true });
        }

        const allowUnsafeUrlFor = (value as any).allowUnsafeUrlFor as string;
        const reason = baseUrl ? unsafeUrlReason(baseUrl) : null;
        if (baseUrl && reason && reason.code !== "invalid" && allowUnsafeUrlFor !== baseUrl) {
          subject.next({ ...(value as any), allowUnsafeUrlFor: baseUrl });
        }
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
    });

    // the first emission is the current value; subsequent emissions are updates
    settings$
      .pipe(
        map((settings$) => settings$.pipe(skip(1))),
        switchAll(),
        takeUntil(this.destroyed$),
      )
      .subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(withLatestFrom(this.settings.valueChanges, settings$), takeUntil(this.destroyed$))
      .subscribe(([, value, settings]) => {
        // convert prefix boolean back to sentinel string for the settings store, and record
        // whichever exact url is currently trusted (may be empty)
        const saveValues = {
          ...(value as any),
          prefix: (value as any).prefix ? "website" : "",
          allowUnsafeUrlFor: this.trustedUrl ?? "",
        };
        settings.next(saveValues as ForwarderOptions);
      });
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  /** Handles commit (blur/change) of the self-host base url field: checks safety, prompts to
   *  trust an unsafe value when needed, and only then persists the field. */
  protected onBaseUrlChange = async (): Promise<void> => {
    const control = this.settings.get(Controls.baseUrl);
    if (!control) {
      return;
    }

    const value = (control.value as string) ?? "";

    if (value === "") {
      this.trustedUrl = null;
      this.save("baseUrl");
      return;
    }

    const unsafe = unsafeUrlReason(value);
    if (unsafe?.code === "invalid") {
      return;
    }

    if (!unsafe) {
      // safe: drop any stale trust recorded for a previously-unsafe value in this field
      this.trustedUrl = null;
    }

    if (unsafe && this.trustedUrl !== value) {
      const trusted = await this.dialogService.openSimpleDialog({
        title: { key: "forwarderUnsafeUrlDialogTitle" },
        content: { key: "forwarderUnsafeUrlDialogContent" },
        type: "warning",
        acceptButtonText: { key: "forwarderTrustUrl" },
        cancelButtonText: { key: "cancel" },
      });

      if (trusted) {
        this.trustedUrl = value;
      } else {
        this.trustedUrl = null;
        control.setValue("");
        this.baseUrlInput()?.nativeElement.focus();
      }
    }

    this.save("baseUrl");
  };

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
