export const withFolders = `Title;User name;Account;URL;Password;Modified;Created;Expire on;Description;Modified by
>>>
Title2;Username2;Account2;http://URL2.com;12345678;27-3-2024 08:11:21;27-3-2024 08:11:21;;;

[Test Folder]
Title Test 1;Username1;Account1;http://URL1.com;Password1;27-3-2024 08:10:52;27-3-2024 08:10:52;;;

[Cert folder]
Certificate 1;;;;;27-3-2024 10:22:39;27-3-2024 10:22:39;;;
test;testtest;;http://test;test;27-3-2024 12:36:59;27-3-2024 12:36:59;;;

[Cert folder\\Nested folder];
test2;testtest;;http://test;test;27-3-2024 12:36:59;27-3-2024 12:36:59;;;`;

export const withMultipleFolders = `Title;User name;Account;URL;Password;Modified;Created;Expire on;Description;Modified by
>>>
Title2;Username2;Account2;http://URL2.com;12345678;27-3-2024 08:11:21;27-3-2024 08:11:21;;;

[Test Folder]
Title Test 1;Username1;Account1;http://URL1.com;Password1;27-3-2024 08:10:52;27-3-2024 08:10:52;;;

[Test Folder\\Level 2 Folder]
Certificate 1;;;;;27-3-2024 10:22:39;27-3-2024 10:22:39;;;
test;testtest;;http://test;test;27-3-2024 12:36:59;27-3-2024 12:36:59;;;

[Test Folder\\Level 2 Folder\\Level 3 Folder]
test2;testtest;;http://test;test;27-3-2024 12:36:59;27-3-2024 12:36:59;;;`;
