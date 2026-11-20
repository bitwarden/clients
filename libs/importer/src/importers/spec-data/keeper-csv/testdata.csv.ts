export const testData = `"Foo","Bar","john.doe@example.com","1234567890abcdef","https://example.com/","These are some notes.",""
"Foo","Bar 1","john.doe1@example.com","234567890abcdef1","https://an.example.com/","","","Account ID","12345","Org ID","54321"
"Foo\\Baz","Bar 2","john.doe2@example.com","34567890abcdef12","https://another.example.com/","","","Account ID","23456","TFC:Keeper","otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30"
`;

export const testDataMultiCollection = `
"Foo\\Baz\\Bar","Bar 2","john.doe2@example.com","34567890abcdef12","https://another.example.com/","","","Account ID","23456","TFC:Keeper","otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30"
"Foo\\Baz","Bar 2","john.doe2@example.com","34567890abcdef12","https://another.example.com/","","","Account ID","23456","TFC:Keeper","otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30"
"Foo","Bar 2","john.doe2@example.com","34567890abcdef12","https://another.example.com/","","","Account ID","23456","TFC:Keeper","otpauth://totp/Amazon:me@company.com?secret=JBSWY3DPEHPK3PXP&issuer=Amazon&algorithm=SHA1&digits=6&period=30"
`;

export const dedicatedItemTypesData = `
"Banks","Test Bank Account","bbaggins@gmail.com","d{24|452Jv/p\`m7bZpJ[","https://bankoftheshire.com","","","Bank Account","Checking | 1234567890 | 12345","Name","Bilbo Baggins"
"","Test Passport","","","","","","Passport Number","1234567890","Name","Bilbo Baggins","Date of Birth","09/22/2890","Address","Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US","Date","06/19/2951","Date Issued","06/19/2941"
"","Test Drivers License","","","","","","Driver's License Number","1234567890","Name","Bilbo Baggins","Date of Birth","09/22/2890","Address","Bag End, Bagshot Row | Under-Hill | Hobbiton | Westfarthing, The Shire | US","Date","09/22/2916"
`;
