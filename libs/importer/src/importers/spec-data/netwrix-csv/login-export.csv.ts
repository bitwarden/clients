export const credentialsData = `"Organisationseinheit";"DataTags";"Beschreibung";"Benutzername";"Passwort";"Internetseite";"Informationen";"One-Time Passwort"
"folderOrCollection1";"tag1, tag2, tag3";"Test Entry 1";"someUser";"somePassword";"https://www.example.com";"some note for example.com";"someTOTPSeed"
"folderOrCollection2";"tag2";"Test Entry 2";"jdoe";"})9+Kg2fz_O#W1§H1-<ox>0Zio";"www.123.com";"Description123";"anotherTOTP"
"folderOrCollection1";"someTag";"Test Entry 3";"username";"password";"www.internetsite.com";"Information";""`;

export const credentialsDataWithFolders = `"Organisationseinheit";"DataTags";"Beschreibung";"Benutzername";"Passwort";"Internetseite";"Informationen";"One-Time Passwort"
"folder1\\folder2\\folder3";"tag1, tag2, tag3";"Test Entry 1";"someUser";"somePassword";"https://www.example.com";"some note for example.com";"someTOTPSeed"`;

// Netwrix exports the website column under different header names depending on the export's
// language/version. Each row below uses one of the alternate headers and should map to a URI.
export const credentialsDataAlternateUriHeaders = `"Beschreibung";"Internetadresse";"Webseite";"Website";"Webmail";"Web page";"URL"
"Internetadresse Entry";"https://www.internetadresse.com";"";"";"";"";""
"Webseite Entry";"";"https://www.webseite.com";"";"";"";""
"Website Entry";"";"";"https://www.website.com";"";"";""
"Webmail Entry";"";"";"";"https://www.webmail.com";"";""
"Web page Entry";"";"";"";"";"https://www.webpage.com";""
"URL Entry";"";"";"";"";"";"https://www.url.com"`;

// Some Netwrix exports (e.g. those produced by scripts) wrap each entire row in an extra layer of
// CSV quoting, doubling the inner quotes. These fixtures reproduce that malformed shape verbatim.
// German headers, enclosed in an extra layer of quotes.
export const credentialsDataEnclosedInQuotes = `"Organisationseinheit;""DataTags"";""Beschreibung"";""Benutzername"";""Passwort"";""Internetadresse"";""EMail-Adresse"";""Kommentare"";""Webseite"";""Webseite1"""
"folderOrCollection1;""tag1, tag2, tag3"";""Test Entry 1"";""someUser"";""somePassword"";""https://www.example.com"";""user@example.com"";""some note for example.com"";""https://webseite.example.com"";""https://webseite1.example.com"""
"folderOrCollection2;"""";""Test Entry 2"";""jdoe"";""secret"";""www.123.com"";""jdoe@123.com"";""Description123"";"""";"""""`;

// English "Organisational unit" header, enclosed in an extra layer of quotes.
export const credentialsDataEnclosedInQuotesEnglishOrgUnit = `"Organisational unit;""DataTags"";""Beschreibung"";""Benutzername"";""Passwort"";""Internetadresse"";""EMail-Adresse"";""Kommentare"";""Webseite"";""Webseite1"""
"Bohn, Markus;"""";""TESTING"";""myUser"";""test"";""example.org"";""blabla@blablablablub.org"";""Noitzen....."";""example.org"";""bitwarden.com"""`;

// Enclosed-in-quotes export whose only row is empty. The re-parse collapses to just the header,
// which must not crash the importer.
export const credentialsDataEnclosedInQuotesEmptyRow = `"Organisationseinheit;""DataTags"";""Beschreibung"";""Benutzername"";""Passwort"";""Internetadresse"";""EMail-Adresse"";""Kommentare"";""Webseite"";""Webseite1"""
""`;
