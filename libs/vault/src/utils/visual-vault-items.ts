import QRCode from "qrcode";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/*
    Wifi View Example
    1. take cipher -> infer(cipher) -> VisualVaultItem::Wifi

    enum VisualVaultItem {
        Wifi {},
        // variant
    }
    
    2. generate (VisualVaultItem enum)

        let qr_code = match (vvi) {
            qr_code_for_wifi(vvi)
        }
*/

type QROptions = "wifi" | "plaintext" | "url";

export function inferQRTypeValuesByCipher(cipher: CipherView): { type: QROptions } {
  switch (cipher.type) {
    case CipherType.Login:
      return { type: "wifi" };
    case CipherType.SecureNote:
    case CipherType.Card:
    case CipherType.Identity:
    case CipherType.SshKey:
    default:
      break;
  }

  return { type: "plaintext" };
}

export function encodeCipherForQRType(
  type: QROptions,
  mapping: any,
  cipherFieldMap: {
    [key: string]: { name: string; label: string; value: string };
  },
): string {
  let encodable: string = "";
  switch (type) {
    case "wifi":
      encodable = `WIFI:S:${cipherFieldMap[mapping.ssid].value};T:<WPA|WEP|>;P:${cipherFieldMap[mapping.password].value};;`;
      break;
    case "url":
      encodable = cipherFieldMap[mapping.link].value;
      break;
    case "plaintext":
    default:
      encodable = cipherFieldMap[mapping.content].value;
      break;
  }

  return encodable;
}

/**
 * Generate a QR code as an SVG Path
 *
 * @param ssid - The wifi ssid
 * @param password - The wifi password
 */
export async function generateQRCodePath(
  type: QROptions,
  mapping: any,
  cipherFieldMap: {
    [key: string]: { name: string; label: string; value: string };
  },
): Promise<string> {
  const encodable = encodeCipherForQRType(type, mapping, cipherFieldMap);

  const svg = await QRCode.toString(encodable, { type: "svg" });

  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");

  const path = doc.firstChild!.lastChild as SVGPathElement;

  return path.attributes.getNamedItem("d")!.value;
}
