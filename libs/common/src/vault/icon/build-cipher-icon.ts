import { Utils } from "../../platform/misc/utils";
import { CipherType } from "../enums/cipher-type";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

export interface CipherIconDetails {
  imageEnabled: boolean;
  image: string | null;
  /**
   * @deprecated Fallback to `icon` instead which will default to "bwi-globe" if no other icon is applicable.
   */
  fallbackImage: string;
  icon: string;
}

export function buildCipherIcon(
  iconsServerUrl: string | null,
  cipher: CipherViewLike,
  showFavicon: boolean,
): CipherIconDetails {
  let icon: string = "bwi-globe";
  let image: string | null = null;
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

  if (iconsServerUrl == null) {
    showFavicon = false;
  }

  const cipherType = CipherViewLikeUtils.getType(cipher);
  const uri = CipherViewLikeUtils.uri(cipher);
  const card = CipherViewLikeUtils.getCard(cipher);

  switch (cipherType) {
    case CipherType.Login:
      icon = "bwi-globe";

      if (uri) {
        let hostnameUri = uri;
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
          } catch {
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
      if (showFavicon && card?.brand && card.brand in cardIcons) {
        icon = `credit-card-icon ${cardIcons[card.brand]}`;
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
