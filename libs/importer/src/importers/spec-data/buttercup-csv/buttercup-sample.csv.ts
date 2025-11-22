// Basic login with subfolder association
export const basicLoginWithSubfolder = `"!group_id","!group_name","!type","title","username","password","URL","id"
"0","Root","--","--","","","","0"
"1","Root/Email","--","--","","","","1"
"1","Root/Email","login","Gmail Account","john@example.com","SecurePass123","https://gmail.com","2"`;

// Custom fields: url and note (case variations)
export const customFieldsCaseSensitive = `"!group_id","!group_name","!type","title","username","password","URL","id","url","note"
"0","Root","--","--","","","","0","",""
"1","Root/Banking","--","--","","","","1","",""
"1","Root/Banking","login","Bank Account","user@bank.com","BankPass456","","2","https://bank.com","Important banking info"`;

// Multiple subfolders with proper nesting
export const multipleSubfolders = `"!group_id","!group_name","!type","title","username","password","URL","id"
"0","Root","--","--","","","","0"
"1","Root/Work","--","--","","","","1"
"2","Root/Work/Clients","--","--","","","","2"
"2","Root/Work/Clients","login","Client Portal","client@work.com","ClientPass789","https://portal.example.com","3"
"1","Root/Work","login","Office VPN","vpnuser","VPNpass","https://vpn.company.com","4"`;

// Custom fields with various case variations
export const caseInsensitiveCustomFields = `"!group_id","!group_name","!type","title","username","password","URL","id","Note","Url"
"0","Root","--","--","","","","0","",""
"0","Root","login","Test Entry","testuser","testpass","","1","This is a NOTE field","https://example.com"`;

// Entry without folder marker but with group name
export const entryWithoutFolderMarker = `"!group_id","!group_name","!type","title","username","password","URL","id"
"1","Root/NoMarker","login","Solo Entry","solo@example.com","SoloPass","https://solo.com","1"`;

// Additional custom fields that should be preserved
export const preservedCustomFields = `"!group_id","!group_name","!type","title","username","password","URL","id","Security Question","Recovery Email"
"0","Root","--","--","","","","0","",""
"0","Root","login","Account","user@test.com","pass123","https://test.com","1","What is your pet name?","backup@example.com"`;

// Entry with username and password (should not be filtered as folder marker)
export const folderMarkerWithCredentials = `"!group_id","!group_name","!type","title","username","password","URL","id"
"0","Root","--","--","admin","adminpass","","0"`;

// Empty CSV
export const emptyData = `"!group_id","!group_name","!type","title","username","password","URL","id"`;

// Multiple URIs from both URL and url fields
export const multipleUris = `"!group_id","!group_name","!type","title","username","password","URL","id","url"
"0","Root","--","--","","","","0",""
"0","Root","login","Multi URL","user","pass","https://primary.com","1","https://secondary.com"`;
