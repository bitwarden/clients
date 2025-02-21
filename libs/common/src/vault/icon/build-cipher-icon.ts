import { Utils } from "../../platform/misc/utils";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";

export function buildCipherIcon(iconsServerUrl: string, cipher: CipherView, showFavicon: boolean) {
  let icon;
  let image;
  let fallbackImage = "";
  const cardIcons: Record<string, string> = {
    Visa: "card-visa",
    Mastercard: "card-mastercard",
    Amex: "card-amex",
    Discover: "card-discover",
    "Diners Club": "card-diners-club",
    JCB: "card-jcb",
    Maestro: "card-maestro",
    UnionPay: "card-union-pay",
    RuPay: "card-ru-pay",
  };

  switch (cipher.type) {
    case CipherType.Login:
      icon = "bwi-globe";

      if (cipher.login.uri) {
        let hostnameUri = cipher.login.uri;
        let isWebsite = false;

        if (hostnameUri.indexOf("androidapp://") === 0) {
          icon = "bwi-android";
          image = null;
        } else if (hostnameUri.indexOf("iosapp://") === 0) {
          icon = "bwi-apple";
          image = null;
        } else if (
          showFavicon &&
          hostnameUri.indexOf("://") === -1 &&
          hostnameUri.indexOf(".") > -1
        ) {
          hostnameUri = `http://${hostnameUri}`;
          isWebsite = true;
        } else if (showFavicon) {
          isWebsite = hostnameUri.indexOf("http") === 0 && hostnameUri.indexOf(".") > -1;
        }

        if (isWebsite && (hostnameUri.endsWith(".onion") || hostnameUri.endsWith(".i2p"))) {
          image = null;
          fallbackImage = "images/bwi-globe.png";
          break;
        }

        if (showFavicon && isWebsite) {
          try {
            image = `${iconsServerUrl}/${Utils.getHostname(hostnameUri)}/icon.png`;
            fallbackImage = "images/bwi-globe.png";
            // FIXME: Remove when updating file. Eslint update
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            // Ignore error since the fallback icon will be shown if image is null.
          }
        }
      } else {
        image = null;
      }
      break;
    case CipherType.SecureNote:
      icon = "bwi-sticky-note";
      break;
    case CipherType.Card:
      icon = "bwi-credit-card";
      if (showFavicon && cipher.card.brand in cardIcons) {
        icon = `credit-card-icon ${cardIcons[cipher.card.brand]}`;
      }
      break;
    case CipherType.Identity:
      icon = "bwi-id-card";
      break;
    case CipherType.SshKey:
      icon = "bwi-key";
      break;
    default:
      break;
  }

  return {
    imageEnabled: showFavicon,
    image,
    fallbackImage,
    icon,
  };
}
