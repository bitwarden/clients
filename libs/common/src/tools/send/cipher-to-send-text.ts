import { CipherType } from "../../vault/enums";
import { FieldType } from "../../vault/enums/field-type.enum";
import { CipherView } from "../../vault/models/view/cipher.view";

import { SendTextView } from "./models/view/send-text.view";
import { SendView } from "./models/view/send.view";
import { SendType } from "./types/send-type";

/**
 * How long a Send created from a vault item lives by default.
 * Conservative default for credential sharing: one day.
 */
const DEFAULT_DELETION_HOURS = 24;

/**
 * Options that control which cipher fields are serialized into the Send body.
 *
 * TOTP and custom fields are excluded by default because:
 * - A shared TOTP seed grants the recipient ongoing access via the regenerating code
 *   (qualitatively different from sharing a one-time password value).
 * - Custom fields commonly hold backup codes, recovery keys, and other secrets the
 *   user did not necessarily intend to forward when sharing a credential.
 */
export interface CipherToSendTextOptions {
  /** When true, includes the TOTP secret on its own line. Defaults to false. */
  includeTotp?: boolean;
  /** When true, includes non-hidden custom fields. Hidden fields are still excluded. Defaults to false. */
  includeCustomFields?: boolean;
}

/**
 * Builds a {@link SendView} pre-filled from a vault item, suitable for seeding the
 * Send composer when a user clicks "Share via Send" on a cipher.
 *
 * The returned view is detached from the cipher; mutating it does not affect the cipher.
 *
 * @param cipher The decrypted vault item to share.
 * @param options Field-inclusion overrides. Defaults exclude TOTP and custom fields.
 * @returns A SendView populated with `name`, `type=Text`, `text`, and a one-day `deletionDate`.
 */
export function cipherToSendTextView(
  cipher: CipherView,
  options: CipherToSendTextOptions = {},
): SendView {
  const view = new SendView();
  view.name = cipher.name ?? "";
  view.type = SendType.Text;

  const text = new SendTextView();
  text.text = formatCipherAsText(cipher, options);
  text.hidden = true;
  view.text = text;

  const deletion = new Date();
  deletion.setHours(deletion.getHours() + DEFAULT_DELETION_HOURS);
  view.deletionDate = deletion;

  return view;
}

function formatCipherAsText(cipher: CipherView, options: CipherToSendTextOptions): string {
  const lines: string[] = [];

  if (cipher.type === CipherType.Login && cipher.login != null) {
    pushIfPresent(lines, "Username", cipher.login.username);
    pushIfPresent(lines, "Password", cipher.login.password);
    pushIfPresent(lines, "Website", cipher.login.uri);
    if (options.includeTotp === true) {
      pushIfPresent(lines, "TOTP", cipher.login.totp);
    }
  }

  if (options.includeCustomFields === true && cipher.fields?.length) {
    for (const field of cipher.fields) {
      // Hidden fields are intentionally never included via this path.
      // They typically store recovery keys / backup codes the user must opt in to share.
      if (field.type === FieldType.Hidden) {
        continue;
      }
      if (field.name && field.value) {
        lines.push(`${field.name}: ${field.value}`);
      }
    }
  }

  if (cipher.notes) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Notes:");
    lines.push(cipher.notes);
  }

  return lines.join("\n");
}

function pushIfPresent(lines: string[], label: string, value: string | undefined | null): void {
  if (value != null && value !== "") {
    lines.push(`${label}: ${value}`);
  }
}
