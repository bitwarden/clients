import QRCode from "qrcode";

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

/**
 * Create a wifi QR code.
 *
 * @param ssid - The wifi ssid
 * @param password - The wifi password
 */
export async function generateWiFiQRCode(ssid: string, password: string): Promise<string> {
  const accessEncoding = `WIFI:S:${ssid};T:<WPA|WEP|>;P:${password};;`;

  return await QRCode.toString(accessEncoding, { type: "svg" });
}
