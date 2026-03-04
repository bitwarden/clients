export const buttercupCsvTestData = `!group_id,!group_name,title,username,password,URL,id
1,General,Test Entry,testuser,testpass123,https://example.com,entry1
1,General,Another Entry,anotheruser,anotherpass,https://another.com,entry2`;

export const buttercupCsvWithUrlFieldTestData = `!group_id,!group_name,title,username,password,url,id
1,General,Entry With Lowercase URL,user1,pass1,https://lowercase-url.com,entry1`;

export const buttercupCsvWithNoteTestData = `!group_id,!group_name,title,username,password,URL,note,id
1,General,Entry With Note,user1,pass1,https://example.com,This is a note,entry1`;

export const buttercupCsvWithCustomFieldsTestData = `!group_id,!group_name,title,username,password,URL,custom_field,another_field,id
1,General,Entry With Custom Fields,user1,pass1,https://example.com,custom value,another value,entry1`;

export const buttercupCsvWithSubfoldersTestData = `!group_id,!group_name,title,username,password,URL,id
1,Work/Projects,Project Entry,projectuser,projectpass,https://project.com,entry1
2,Personal/Finance,Finance Entry,financeuser,financepass,https://finance.com,entry2`;
