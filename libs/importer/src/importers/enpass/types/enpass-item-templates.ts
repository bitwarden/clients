type Login = "login.default";

type CreditCard = "creditcard.default";

type Identity = "identity.default";

type Note = "note.default";

type Password = "password.default";

type Finance =
  | "finance.stock"
  | "finance.bankaccount"
  | "finance.loan"
  | "finance.mutualfund"
  | "finance.insurance"
  | "finance.other";

type License = "license.driving" | "license.hunting" | "license.software" | "license.other";

type Travel =
  | "travel.passport"
  | "travel.flightdetails"
  | "travel.hotelreservation"
  | "travel.visa"
  | "travel.freqflyer"
  | "travel.other";

type Computer =
  | "computer.database"
  | "computer.emailaccount"
  | "computer.ftp"
  | "computer.messaging"
  | "computer.internetprovider"
  | "computer.server"
  | "computer.wifi"
  | "computer.hosting"
  | "computer.other";

type Misc =
  | "misc.Aadhar"
  | "misc.address"
  | "misc.library"
  | "misc.rewardprogram"
  | "misc.lens"
  | "misc.service"
  | "misc.vehicleinfo"
  | "misc.itic"
  | "misc.itz"
  | "misc.propertyinfo"
  | "misc.clothsize"
  | "misc.contact"
  | "misc.membership"
  | "misc.cellphone"
  | "misc.emergencyno"
  | "misc.pan"
  | "misc.identity"
  | "misc.regcode"
  | "misc.prescription"
  | "misc.serial"
  | "misc.socialsecurityno"
  | "misc.isic"
  | "misc.calling"
  | "misc.voicemail"
  | "misc.voter"
  | "misc.combilock"
  | "misc.other";

export type EnpassItemTemplate =
  | Login
  | CreditCard
  | Identity
  | Note
  | Password
  | Finance
  | License
  | Travel
  | Computer
  | Misc;
