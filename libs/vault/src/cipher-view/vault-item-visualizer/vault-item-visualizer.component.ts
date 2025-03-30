import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  effect,
  Input,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { QRCodeOption } from "@bitwarden/common/platform/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  TypographyModule,
  ButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  CardComponent,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { generateQRCodePath } from "@bitwarden/vault";

interface FieldMappingsGroup {
  ssid?: FormControl<string>;
  password?: FormControl<string>;
  link?: FormControl<string>;
  content?: FormControl<string>;
  firstname?: FormControl<string>;
  lastname?: FormControl<string>;
  job?: FormControl<string>;
  address?: FormControl<string>;
  phone?: FormControl<string>;
  email?: FormControl<string>;
  url?: FormControl<string>;
  company?: FormControl<string>;
}

type FieldTuple = [string, string, string];

type MappingFunction = (option: { name: string; label: string }, index?: number) => boolean;

type FieldMappingControl = {
  label: string;
  name: keyof FieldMappingsGroup;
  mappings?: Array<string | MappingFunction>;
  /* Deprecate me */
  options?: Array<{ name: string; label: string; value: string }>;
};
@Component({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TypographyModule,
    ButtonModule,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    CardComponent,
    FormsModule,
    FormFieldModule,
    SelectModule,
  ],
  selector: "vault-item-visualizer",
  standalone: true,
  templateUrl: "./vault-item-visualizer.component.html",
})
export class VaultItemVisualizerComponent implements OnInit {
  @Input() cipher?: CipherView;

  // @TODO strings + translations
  // headerText: string;
  dataToShareTitle: string = "Data to share";

  qrCodeOptions: { name: string; value: string }[];

  visualizeForm = new FormGroup({
    qrCodeType: new FormControl<QRCodeOption>(null),
    /* TODO: enumerate possible types for fieldMappings? */
    fieldMappings: new FormGroup<FieldMappingsGroup>({}),
  });

  dataToShareValues = toSignal(this.visualizeForm.valueChanges);

  qrCodeViewBox: WritableSignal<string> = signal("0 0 0 0");
  qrCodePath: WritableSignal<string> = signal("");

  cipherFieldTuples: WritableSignal<Array<FieldTuple>> = signal([]);

  availableCipherFields: Signal<Array<{ name: string; label: string }>> = computed(() =>
    this.cipherFieldTuples().reduce(
      (prev: Array<{ name: string; label: string }>, [name, label]) => {
        return [
          ...prev,
          {
            name,
            label,
          },
        ];
      },
      [],
    ),
  );

  availableCipherFieldsMap: Signal<{
    [key: string]: { name: string; label: string; value: string };
  }> = computed(() =>
    this.cipherFieldTuples().reduce((prev, [name, label, value]) => {
      return {
        ...prev,
        [name]: {
          name,
          label,
          value,
        },
      };
    }, {}),
  );

  fieldMappingsControlMeta: {
    [key: string]: { label: string; controls: Array<FieldMappingControl> };
  } = {
    wifi: {
      label: "Wi-Fi",
      controls: [
        {
          label: "SSID",
          name: "ssid",
          // @TODO needs i18n for mapping and rendering (Custom field:)
          mappings: ["username", (option) => option.label === "Custom field: SSID"],
        },
        {
          label: "Password",
          name: "password",
          mappings: ["password"],
        },
        // {
        //   label: "Additional Options",
        //   name: "additional",
        //   value: "",
        //   options: [{ label: "Custom: Wi-Fi Options", name: "additional.match", value: "match" }],
        // },
      ],
    },
    url: {
      label: "URL",
      controls: [
        {
          label: "Link",
          name: "link",
          mappings: [
            "notes",
            (option) => option.label.indexOf(this.i18nService.t("websiteUriCount")) >= 0,
          ],
        },
      ],
    },
    plaintext: {
      label: "Plain Text",
      controls: [
        {
          label: "Content",
          name: "content",
          mappings: ["notes"],
        },
      ],
    },
    email: {
      label: "Email",
      controls: [
        {
          label: "Email",
          name: "email",
          /* Deprecate all options props */
          options: [
            { label: "Username", name: "email.username", value: "username" },
            { label: "Email", name: "email.match", value: "match" },
          ],
        },
      ],
    },
    phone: {
      label: "Phone",
      controls: [
        {
          label: "Phone",
          name: "phone",
          options: [{ label: "Phone", name: "phone.match", value: "match" }],
        },
      ],
    },
    meCard: {
      label: "Contact (MeCard)",
      controls: [
        {
          label: "Last Name",
          name: "lastname",
          options: [{ label: "Last Name", name: "meCard.lastname", value: "lastname" }],
        },
        {
          label: "First Name",
          name: "firstname",
          options: [{ label: "First Name", name: "meCard.firstname", value: "firstname" }],
        },
        {
          label: "Phone",
          name: "phone",
          options: [{ label: "Phone", name: "meCard.phone", value: "phone" }],
        },
        {
          label: "Email",
          name: "email",
          options: [
            { label: "Username", name: "meCard.username", value: "username" },
            { label: "Email", name: "meCard.email", value: "email" },
          ],
        },
      ],
    },
    vCard: {
      label: "Contact (vCard)",
      controls: [
        {
          label: "Last Name",
          name: "lastname",
          options: [{ label: "Last Name", name: "vCard.lastname", value: "lastname" }],
        },
        {
          label: "First Name",
          name: "firstname",
          options: [{ label: "First Name", name: "vCard.firstname", value: "firstname" }],
        },
        {
          label: "Phone",
          name: "phone",
          options: [{ label: "Phone", name: "vCard.phone", value: "phone" }],
        },
        {
          label: "Email",
          name: "email",
          options: [
            { label: "Username", name: "vCard.username", value: "username" },
            { label: "Email", name: "vCard.email", value: "email" },
          ],
        },
        {
          label: "Address",
          name: "address",
          options: [{ label: "Address", name: "vCard.address", value: "address" }],
        },
        {
          label: "URL",
          name: "url",
          options: [
            { label: "Notes", name: "vCard.url.notes", value: "notes" },
            { label: "Custom: URL", name: "vCard.url.custom", value: "custom" },
          ],
        },
        {
          label: "Company",
          name: "company",
          options: [{ label: "Company", name: "vCard.company", value: "company" }],
        },
        {
          label: "Job Title",
          name: "job",
          options: [
            { label: "Notes", name: "vCard.job.notes", value: "notes" },
            { label: "Custom: Job Title", name: "vCard.job.custom", value: "custom" },
          ],
        },
      ],
    },
  };

  get qrCodeType() {
    return this.visualizeForm.value.qrCodeType;
  }

  get fieldMappingsGroup(): FormGroup {
    return this.visualizeForm.controls.fieldMappings;
  }

  get fieldMappingsControls(): Array<FieldMappingControl> {
    return this.fieldMappingsControlMeta[this.qrCodeType].controls;
  }

  constructor(
    private fb: FormBuilder,
    private i18nService: I18nService,
  ) {
    /* Set initial QR Code options */
    this.qrCodeOptions = [
      { name: "Wi-Fi", value: "wifi" },
      { name: "Plain Text", value: "plaintext" },
      { name: "URL", value: "url" },
      // { name: i18nService.t("example"), value: example },
    ];
    // Example on how to add all types from meta.
    // this.qrCodeOptions = Object.keys(this.fieldMappingsControlMeta).map((qrCodeOption) => {
    //   return { name: this.fieldMappingsControlMeta[qrCodeOption].label, value: qrCodeOption };
    // });

    effect(async () => {
      /* Retriggers whenever form changes */
      const values = this.dataToShareValues();

      if (typeof values !== "undefined" && values.qrCodeType !== null) {
        /* @TODO pass the fieldMappings select values with cipher data, let bkgd fn handle? */
        const { path, viewBox } = await generateQRCodePath(
          values.qrCodeType,
          values.fieldMappings,
          this.availableCipherFieldsMap(),
        );
        this.qrCodeViewBox.set(viewBox);
        this.qrCodePath.set(path);
      }
    });

    this.visualizeForm.controls.qrCodeType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        const controlNames = this.fieldMappingsControls.map(({ name }) => name);
        for (const controlName of controlNames) {
          this.visualizeForm.controls.fieldMappings.removeControl(
            controlName as keyof FieldMappingsGroup,
          );
        }
        this.updateAvailableCipherFields();
        this.updateControls();
      });
  }

  updateControls() {
    const fields = this.fieldMappingsControls;
    for (const { name, mappings = [] } of fields) {
      const cipherFields = this.availableCipherFields();
      const cipherFieldMap = this.availableCipherFieldsMap();

      this.visualizeForm.controls.fieldMappings.addControl(name, this.fb.control(""));
      const isFirstValue = (_: any, i: number) => i === 0;
      const mapped = [...mappings, isFirstValue]
        .map((mapping) => {
          const f: MappingFunction =
            typeof mapping === "string" ? (option) => option.name === mapping : mapping;
          return cipherFields.find(f);
        })
        .find((mapping) => {
          return mapping?.name && cipherFieldMap[mapping.name].value !== null;
        });

      this.visualizeForm.controls.fieldMappings.controls[name].setValue(mapped.name);
    }
  }

  async ngOnInit() {
    /* Set default QR Code Type and field fieldMappings after inference (TODO) */
    this.visualizeForm.controls.qrCodeType.setValue("wifi", { emitEvent: false });
    /* Ensure form updated, allow subscribers */
    this.updateAvailableCipherFields();
    this.updateControls();
  }

  updateAvailableCipherFields() {
    const fields: Array<FieldTuple> = [];

    if (this.cipher.type === CipherType.Identity) {
      const username: FieldTuple = [
        "username",
        this.i18nService.t("username"),
        this.cipher.identity.username,
      ];
      const email: FieldTuple = ["email", this.i18nService.t("email"), this.cipher.identity.email];

      fields.push(username, email);
    }
    if (this.cipher.type === CipherType.Login) {
      const username: FieldTuple = [
        "username",
        this.i18nService.t("username"),
        this.cipher.login.username,
      ];
      const password: FieldTuple = [
        "password",
        this.i18nService.t("password"),
        this.cipher.login.password,
      ];

      fields.push(username, password);

      const uris = this.cipher.login.uris.map(
        ({ uri }, i): FieldTuple => [`uri.${i}`, this.i18nService.t("websiteUriCount", i + 1), uri],
      );

      fields.push(...uris);

      const custom = (this.cipher.fields ?? []).map(
        (field, i): FieldTuple => [`field.${i}`, `Custom field: ${field.name}`, field.value],
      );
      fields.push(...custom);
    }

    const notes: FieldTuple = ["notes", this.i18nService.t("notes"), this.cipher.notes];
    fields.push(notes);

    this.cipherFieldTuples.set(fields);
  }
}
