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
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, ReplaySubject, skip, Subject, switchAll, takeUntil, withLatestFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { VendorId } from "@bitwarden/common/tools/extension";
import {
  FormFieldModule,
  AriaDisableDirective,
  TooltipDirective,
  BitIconButtonComponent,
} from "@bitwarden/components";
import {
  CredentialGeneratorService,
  ForwarderOptions,
  GeneratorMetadata,
} from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";

const Controls = Object.freeze({
  domain: "domain",
  token: "token",
  baseUrl: "baseUrl",
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

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    [Controls.domain]: [""],
    [Controls.token]: [""],
    [Controls.baseUrl]: [""],
  });

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

        forwarder$.next(forwarder);
      });

    const settings$ = forwarder$.pipe(
      map((forwarder) => this.generatorService.settings(forwarder, { account$: this.account$ })),
    );

    // bind settings to the reactive form
    settings$.pipe(switchAll(), takeUntil(this.destroyed$)).subscribe((settings) => {
      // skips reactive event emissions to break a subscription cycle
      this.settings.patchValue(settings as any, { emitEvent: false });
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
        settings.next(value as ForwarderOptions);
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

  private readonly refresh$ = new Subject<void>();

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
