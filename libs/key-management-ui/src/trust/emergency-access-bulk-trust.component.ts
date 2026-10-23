import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LockIcon } from "@bitwarden/assets/svg";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AccordionComponent,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  SegmentedCardComponent,
  CheckboxModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormControlModule,
  LinkModule,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";

export type EmergencyAccessBulkTrustContact = {
  /** id of the emergency access grant */
  id: string;
  /** user id of the grantee */
  granteeId: string;
  /** display name of the grantee */
  name: string;
  /** grantee public key */
  publicKey: Uint8Array;
};

type EmergencyAccessBulkTrustDialogData = {
  contacts: EmergencyAccessBulkTrustContact[];
};

/** Ids of the emergency access grants the user trusts. Undefined if the user skips. */
type EmergencyAccessBulkTrustDialogResult = string[] | undefined;

/**
 * Prompts the user to trust all emergency access grantees in one dialog during user key rotation.
 * All contacts are selected by default. The fingerprint phrase of each contact is shown on demand.
 */
@Component({
  selector: "emergency-access-bulk-trust",
  templateUrl: "emergency-access-bulk-trust.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionComponent,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    SegmentedCardComponent,
    CheckboxModule,
    CommonModule,
    DialogModule,
    FormControlModule,
    JslibModule,
    LinkModule,
    ReactiveFormsModule,
    SvgComponent,
    TypographyModule,
  ],
})
export class EmergencyAccessBulkTrustComponent implements OnInit {
  protected readonly params = inject<EmergencyAccessBulkTrustDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<EmergencyAccessBulkTrustDialogResult>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly legacyCompatKeyService = inject(LegacyCompatKeyService);
  private readonly logService = inject(LogService);

  protected readonly lockIcon = LockIcon;
  protected readonly loading = signal(true);
  protected readonly fingerprints = signal<Record<string, string>>({});

  protected readonly trustForm = this.formBuilder.nonNullable.record(
    Object.fromEntries(this.params.contacts.map((contact) => [contact.id, true])),
  );

  async ngOnInit() {
    const fingerprints: Record<string, string> = {};
    for (const contact of this.params.contacts) {
      try {
        const fingerprint = await this.legacyCompatKeyService.getFingerprint(
          contact.granteeId,
          contact.publicKey,
        );
        if (fingerprint != null) {
          fingerprints[contact.id] = fingerprint.join("-");
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
    this.fingerprints.set(fingerprints);
    this.loading.set(false);
  }

  protected readonly submit = async () => {
    if (this.loading()) {
      return;
    }

    const trusted = Object.entries(this.trustForm.getRawValue())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
    await this.dialogRef.close(trusted);
  };

  /**
   * Strongly typed helper to open an EmergencyAccessBulkTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param data The data to pass to the dialog
   */
  static open(dialogService: DialogService, data: EmergencyAccessBulkTrustDialogData) {
    return dialogService.open<
      EmergencyAccessBulkTrustDialogResult,
      EmergencyAccessBulkTrustDialogData
    >(EmergencyAccessBulkTrustComponent, { data });
  }
}
