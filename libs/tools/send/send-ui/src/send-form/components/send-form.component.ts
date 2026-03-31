// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgIf } from "@angular/common";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  EventEmitter,
  forwardRef,
  Inject,
  inject,
  Input,
  OnChanges,
  OnInit,
  Optional,
  output,
  Output,
  viewChild,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  FormFieldModule,
  ItemModule,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { MakeSendFolderEntry } from "@bitwarden/sdk-internal";

import { SendFileProviderService } from "../abstractions/send-file-provider.service";
import { SendFormConfig } from "../abstractions/send-form-config.service";
import { SendFormService } from "../abstractions/send-form.service";
import { SendForm, SendFormContainer } from "../send-form-container";

import { SendDetailsComponent } from "./send-details/send-details.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-form",
  templateUrl: "./send-form.component.html",
  providers: [
    {
      provide: SendFormContainer,
      useExisting: forwardRef(() => SendFormComponent),
    },
  ],
  imports: [
    AsyncActionsModule,
    TypographyModule,
    ItemModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    NgIf,
    SendDetailsComponent,
  ],
})
export class SendFormComponent implements AfterViewInit, OnInit, OnChanges, SendFormContainer {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;
  private destroyRef = inject(DestroyRef);
  private _firstInitialized = false;
  private file: File | null = null;
  private folderFiles: FileList | null = null;
  private multipleFiles: FileList | null = null;

  /**
   * The form ID to use for the form. Used to connect it to a submit button.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) formId: string;

  /**
   * The configuration for the add/edit form. Used to determine which controls are shown and what values are available.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) config: SendFormConfig;

  /**
   * Optional submit button that will be disabled or marked as loading when the form is submitting.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  submitBtn?: ButtonComponent;

  /**
   * Event emitted when the send is created successfully.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSendCreated = new EventEmitter<SendView>();

  /**
   * Event emitted when the send is updated successfully.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSendUpdated = new EventEmitter<SendView>();

  /**
   * Event emitted when the user requests to open the password generator.
   */
  readonly openPasswordGenerator = output<void>();

  readonly sendDetailsComponent = viewChild(SendDetailsComponent);

  /**
   * The original send being edited or cloned. Null for add mode.
   */
  originalSendView: SendView | null;

  /**
   * The form group for the send. Starts empty and is populated by child components via the `registerChildForm` method.
   * @protected
   */
  protected sendForm = this.formBuilder.group<SendForm>({});

  /**
   * The value of the updated send. Starts as a new send and is updated
   * by child components via the `patchSend` method.
   * @protected
   */
  protected updatedSendView: SendView | null;
  protected loading: boolean = true;

  SendType = SendType;

  ngAfterViewInit(): void {
    if (this.submitBtn) {
      this.bitSubmit.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
        this.submitBtn.loading.set(loading);
      });

      this.bitSubmit.disabled$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((disabled) => {
        this.submitBtn.disabled.set(disabled);
      });
    }
  }

  /**
   * Registers a child form group with the parent form group. Used by child components to add their form groups to
   * the parent form for validation.
   * @param name - The name of the form group.
   * @param group - The form group to add.
   */
  registerChildForm<K extends keyof SendForm>(
    name: K,
    group: Exclude<SendForm[K], undefined>,
  ): void {
    this.sendForm.setControl(name, group);
  }

  /**
   * Method to update the sendView with the new values. This method should be called by the child form components
   * @param updateFn - A function that takes the current sendView and returns the updated sendView
   */
  patchSend(updateFn: (current: SendView) => SendView): void {
    this.updatedSendView = updateFn(this.updatedSendView);
  }

  /**
   * We need to re-initialize the form when the config is updated.
   */
  async ngOnChanges() {
    // Avoid re-initializing the form on the first change detection cycle.
    if (this._firstInitialized) {
      await this.init();
    }
  }

  async ngOnInit() {
    await this.init();
    this._firstInitialized = true;
  }

  async init() {
    this.loading = true;
    this.updatedSendView = new SendView();
    this.originalSendView = null;
    this.file = null;
    this.folderFiles = null;
    this.multipleFiles = null;
    this.sendForm.reset();

    if (this.config == null) {
      return;
    }

    if (this.config.mode !== "add") {
      if (this.config.originalSend == null) {
        throw new Error("Original send is required for edit or clone mode");
      }

      this.originalSendView = await this.addEditFormService.decryptSend(this.config.originalSend);

      this.updatedSendView = Object.assign(this.updatedSendView, this.originalSendView);
    } else {
      this.updatedSendView.type = this.config.sendType;
    }

    this.loading = false;
  }

  constructor(
    private formBuilder: FormBuilder,
    private addEditFormService: SendFormService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private sdkService: SdkService,
    private logService: LogService,
    @Optional() @Inject(SendFileProviderService) private sendFileProvider: SendFileProviderService,
  ) {}

  onFileSelected(file: File): void {
    this.file = file;
  }

  onFolderSelected(files: FileList): void {
    this.folderFiles = files;
  }

  onMultipleFilesSelected(files: FileList): void {
    this.multipleFiles = files;
  }

  submit = async () => {
    if (this.sendForm.invalid) {
      this.sendForm.markAllAsTouched();
      return;
    }

    let fileOrBuffer: File | ArrayBuffer = this.file;

    // Handle preloaded paths from desktop context menu (single or multi-select)
    if (
      this.config.preloadedPaths != null &&
      this.config.preloadedPaths.length > 0 &&
      this.sendFileProvider != null
    ) {
      fileOrBuffer = await this.readPreloadedPaths(this.config.preloadedPaths);
    } else if (this.multipleFiles != null && this.multipleFiles.length > 1) {
      // Handle multi-file selection from file picker — zip via SDK
      fileOrBuffer = await this.zipBrowserFiles(
        Array.from(this.multipleFiles).map((f) => ({ file: f, path: f.name })),
        "Send",
      );
    } else if (this.folderFiles != null && this.folderFiles.length > 0) {
      const firstPath = this.folderFiles[0].webkitRelativePath;
      const folderName = firstPath.split("/")[0];
      fileOrBuffer = await this.zipBrowserFiles(
        Array.from(this.folderFiles).map((f) => ({ file: f, path: f.webkitRelativePath })),
        folderName,
      );
    }

    const sendView = await this.addEditFormService.saveSend(
      this.updatedSendView,
      fileOrBuffer,
      this.config,
    );

    if (this.config.mode === "add") {
      this.onSendCreated.emit(sendView);
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("editedItem"),
    });
    this.onSendUpdated.emit(this.updatedSendView);
  };

  /**
   * Read preloaded paths from the desktop filesystem via IPC.
   * A single non-directory file is returned as a raw ArrayBuffer;
   * everything else is zipped via the SDK.
   */
  private async readPreloadedPaths(
    paths: NonNullable<SendFormConfig["preloadedPaths"]>,
  ): Promise<ArrayBuffer> {
    // Single non-directory file — send as plain file, no zip
    if (paths.length === 1 && !paths[0].isDirectory) {
      const contents = await this.sendFileProvider.readFile(paths[0].path);
      return contents.buffer as ArrayBuffer;
    }

    // Multiple entries or a directory — collect and zip
    const allEntries: MakeSendFolderEntry[] = [];
    let folderName = "Send";

    for (const p of paths) {
      if (p.isDirectory) {
        folderName = p.name;
        const dirEntries = await this.sendFileProvider.readDirectory(p.path);
        for (const e of dirEntries) {
          allEntries.push({
            path: `${p.name}/${e.relativePath}`,
            contents: e.contents,
          });
        }
      } else {
        const contents = await this.sendFileProvider.readFile(p.path);
        allEntries.push({
          path: p.name,
          contents: Array.from(new Uint8Array(contents)),
        });
      }
    }

    return this.makeSendFolder(allEntries, folderName);
  }

  /**
   * Zip browser File objects via the SDK and update the send view with the result.
   */
  private async zipBrowserFiles(
    files: Array<{ file: File; path: string }>,
    folderName: string,
  ): Promise<ArrayBuffer> {
    const entries: MakeSendFolderEntry[] = [];
    for (const { file, path } of files) {
      const buffer = await file.arrayBuffer();
      entries.push({
        path,
        contents: Array.from(new Uint8Array(buffer)),
      });
    }
    return this.makeSendFolder(entries, folderName);
  }

  /**
   * Shared helper: call SDK make_send_folder and update the send view with the zip result.
   */
  private async makeSendFolder(
    entries: MakeSendFolderEntry[],
    folderName: string,
  ): Promise<ArrayBuffer> {
    const client = await firstValueFrom(this.sdkService.client$);
    const result = client.sends().make_send_folder({ folderName, files: entries });

    const fileView = new SendFileView();
    fileView.id = result.file.id ?? null;
    fileView.fileName = result.file.fileName;
    fileView.size = result.file.size;
    fileView.sizeName = result.file.sizeName;

    this.updatedSendView.type = SendType.File;
    this.updatedSendView.file = fileView;
    return new Uint8Array(result.contents).buffer;
  }
}
