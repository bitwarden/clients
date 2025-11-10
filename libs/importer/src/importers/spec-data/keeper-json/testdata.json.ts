export const TestData = {
  shared_folders: [
    {
      path: "CanManageRecords-CanEdit",
      uid: "6qDHxtPzarYTUT2qUeAbEw",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "CanManageUsers-ViewOnly",
      uid: "WcN2l5aiDnh7HkTWMltvaw",
      manage_users: true,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "FullAccess-CanShare",
      uid: "fe0k0gvf4hlz4O2Q_Chd-A",
      manage_users: true,
      manage_records: true,
      can_edit: false,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "NoUserPerms-EditAndShare",
      uid: "DV9REMgwvpfhAn24ACGDew",
      manage_users: false,
      manage_records: false,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "Empty Folder\\Empty Nested Folder Level 2\\Empty Nested Folder Level 3\\Shared Folder Inside Empty Nested Folder",
      uid: "7NUCFWidoEurHXTpmDMGzw",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "Clients\\Enterprise\\North America\\TechCorp\\Shared-Needsted-Deep-Inside-Normal-Folder",
      uid: "VztEEZGdprd5UjrQatEVuA",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+06-november-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
  ],
  records: [
    {
      title: "Family Vacation 2024",
      uid: "a9I7CW9cTlbmQcG4pJApVw",
      notes: "Summer vacation photos from Hawaii trip - scenic beach views",
      $type: "photo",
      last_modified: 1762428779,
      folders: [
        {
          folder: "Work",
        },
      ],
    },
    {
      title: "Production MySQL Database",
      uid: "C5oaP6QaaKEyy0dvqz-Zag",
      login: "db_admin",
      password: "SecureDb#2024$Pass",
      notes: "Production database server for main application - handle with care",
      $type: "databaseCredentials",
      last_modified: 1762428779,
      custom_fields: {
        "$text:type": "MySQL",
        $host: {
          hostName: "db.production.company.com",
          port: "3306",
        },
      },
      folders: [
        {
          folder:
            "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes\\Name\\\\with\\\\backslashes",
        },
        {
          folder: "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes",
        },
      ],
    },
    {
      title: "Home Wi-Fi",
      uid: "aJ4WKh1LaE1r36-cySijhg",
      password: "secure-password-123",
      notes: "My cozy home wi-fi",
      $type: "wifiCredentials",
      last_modified: 1762431492,
      custom_fields: {
        "$text:SSID": "cozy-home-netz",
      },
    },
    {
      title: "General Information Record",
      uid: "sQvo45TcWZeJdaHWBZ7Kvg",
      login: "general_user@example.com",
      password: "GeneralPass#2024!Secure",
      login_url: "https://general.example.com",
      notes: "General purpose record for miscellaneous information and credentials",
      $type: "login",
      last_modified: 1762428779,
      custom_fields: {
        $oneTimeCode:
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
      },
      folders: [
        {
          folder: "Personal\\Finance\\Banking\\Accounts",
        },
      ],
    },
    {
      title: "National Identity Card",
      uid: "weeQm7T_UJ15HE_8iUqkRg",
      notes: "National identification card - Valid through 2028",
      $type: "ssnCard",
      last_modified: 1762428779,
      custom_fields: {
        "$accountNumber:identityNumber": "ID-7849521",
        $name: {
          first: "Sarah",
          middle: "Elizabeth",
          last: "Johnson",
        },
      },
      folders: [
        {
          folder:
            "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes\\Name\\\\with\\\\backslashes",
        },
      ],
    },
    {
      title: "US Passport",
      uid: "zkMYLQF8y9UrT40stDWz8w",
      password: "Passport2023!Secure",
      notes: "Valid US passport for international travel",
      $type: "passport",
      last_modified: 1762428779,
      custom_fields: {
        "$accountNumber:passportNumber": "543826194",
        $name: {
          first: "Jennifer",
          middle: "Lynn",
          last: "Williams",
        },
        $birthDate: 648597600000,
        $expirationDate: 2005596000000,
        "$date:dateIssued": 1692050400000,
      },
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes",
        },
      ],
    },
    {
      title: "Wells Fargo Checking",
      uid: "c3UzsqSASkGaIIlv86FVOQ",
      login: "m.thompson@email.com",
      password: "BankS3cur3!Pass",
      notes: "Primary checking account for direct deposit and bill payments",
      $type: "bankAccount",
      last_modified: 1762428779,
      custom_fields: {
        $bankAccount: {
          accountType: "Checking",
          routingNumber: "121000248",
          accountNumber: "8472651938",
          otherType: "",
        },
        $name: {
          first: "Michael",
          middle: "James",
          last: "Thompson",
        },
        $oneTimeCode:
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
      },
      folders: [
        {
          folder: "Clients\\Enterprise\\North America\\TechCorp",
        },
      ],
    },
    {
      title: "LA Fitness Gym",
      uid: "x_T8ZOZ-_UGjyDbQJbG_yQ",
      password: "FitLife2024!Strong",
      notes: "Annual membership - full gym access including pool and classes",
      $type: "membership",
      last_modified: 1762428779,
      custom_fields: {
        $accountNumber: "LAF-987654321",
        $name: {
          first: "Lisa",
          middle: "Marie",
          last: "Rodriguez",
        },
      },
      folders: [
        {
          folder: "Personal\\Finance\\Banking",
        },
      ],
    },
    {
      title: "Oregon Driver's License",
      uid: "CcXjagWjE9IiHbpKizkAKA",
      notes: "Valid Oregon driver's license - Class C",
      $type: "driverLicense",
      last_modified: 1762428779,
      custom_fields: {
        "$accountNumber:dlNumber": "DL-7482693",
        $name: {
          first: "Robert",
          middle: "William",
          last: "Anderson",
        },
        $birthDate: 479689200000,
        $expirationDate: 1836687600000,
      },
      folders: [
        {
          folder:
            "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes\\Name\\\\with\\\\backslashes",
        },
        {
          folder: "Development\\Web",
        },
      ],
    },
    {
      title: "Production Server SSH Key",
      uid: "E1124I_NzDheHSckN3cEQA",
      login: "deploy_user",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      last_modified: 1762775800,
      custom_fields: {
        $keyPair: {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCO+QPW2WUMkkuYQ06cNm9q+IYeDSMZpbBdXOGk0PF8U6f1SAiuHnPkmGcIG7WcCMogVMC+XVrKtUEttXQiIh77udzntP/nLOMosG1/BzTUvSQl24MnnLheAZeebGoMIiInM0tEMRGF+Xaxo+fO9k2Aexakh5Uk8VifuagEEf2XO5CX1rkIM+ApV/Djx7r3JTOisY9Xbaizz1sU7urz1THxXsLP+dZ2d6o5yk/Gv7rEoX+0a7i8KAZyEiPF63NVtQfrd8ZvVraxQJOCLZkEyLyDdK/xE+JSIBTLVvHpMJ/GZ49QuDOaqc6aUqBYIzh9ahxE9GVOQBJD3kueWwBXSyqZ ",
          privateKey:
            "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAjvkD1tllDJJLmENOnDZvaviGHg0jGaWwXVzhpNDxfFOn9UgI\nrh5z5JhnCBu1nAjKIFTAvl1ayrVBLbV0IiIe+7nc57T/5yzjKLBtfwc01L0kJduD\nJ5y4XgGXnmxqDCIiJzNLRDERhfl2saPnzvZNgHsWpIeVJPFYn7moBBH9lzuQl9a5\nCDPgKVfw48e69yUzorGPV22os89bFO7q89Ux8V7Cz/nWdneqOcpPxr+6xKF/tGu4\nvCgGchIjxetzVbUH63fGb1a2sUCTgi2ZBMi8g3Sv8RPiUiAUy1bx6TCfxmePULgz\nmqnOmlKgWCM4fWocRPRlTkASQ95LnlsAV0sqmQIDAQABAoIBACrTfonp3rHwVIKM\njsyOJbvGK+5ugvgYwIaG3vROvjc+m84GQMtfRdnQqPQt0K2nmFws5vte3WZg+uAl\nPV9IFz3SA9DIT+tAb97tUi89yl57NYu9gEDqWfOWyILk+LMfullBrScFB7m46wv1\nC+fbsYVt2W95SXyiaqiVpTVq6ipVc4jJ5LAESiLLVIK+TFf+CJcxKmCGeLNZCG+/\nqIJ+Coc/UO26T2P94naNpgPUkThHr2425fZ7hjgjyxIy6PpyiXl4VZYtoHT/Ezb9\n/Is3Vj8i+nKYw9HXhqrXit5niK97AAdQRZ3maJ3YjS/fgWKB6O83dOv8v7VhdmE4\nP3PzZwECgYEAycA0PkzG0t9DxzPZKIRhXJuNvGcPsjdn32bMo9cCjeR9ihtDCoAl\nFAjxNxcluQwDA1eFAXnkfrs72nJLl4q/mQ3FJmJN0bVrlrTSHlMLXQ+4UmP4NqmP\ncm1/u0zDcJaXosPNjL1WUd/O1LSDUivL21enfctuPAseeHnMc9qKIbkCgYEAtWq9\nd53ZputpNaurjid2snw1ZTF7EQajV6A0jq1sPuqtIpNQX9Nbb3EE9SThkqgIXb6w\nOtwO6krfr5qrfQxWasIUi9t9oCkMwmfOvPbHObuFeE2STviT3JaJ2OOSHTd1Ra3J\nvP4Ban6XURqpx/XLpGYkfV4nX8JZ+xcd6InPP+ECgYAtRKw0QmPmUuRRYSfbuIBk\nGB8gY/uYoGf1L4rBRHA1SEyG3YEYbRJkwXDmTJJRSAmxCUU1xJTpfrd6V2Twttgw\nzm8rIqmVYWCnqyDuXvHQysMv8XBzS259XWZor1u2+oNBqS+I4b7plg9BmNNSb7NJ\nHwzc4/VzEYefvqyKXkHaOQKBgED89NSF2nNeP3k3fyRUZMP5lNMkT5bAzwDT5h/6\nZh1/yffp19AMEeQxE3qR9LCpux2B8vWS4VDy84CforEQG2DxF5UmUrFuIyD9OOUe\nbi3zTBPVjgT2LVnHH6hvlWcb98m3QN6QC4fPw3sNVybHmWTSJl42vVojcEJvfIpR\n28lhAoGBAIxKiw9Rf8tqR/hI1f/zOq6lidS5d0ajU/ip9V7aaNRYbjrhP+nJyDfi\n4Q6Zcw8+lbG89CK/a659Qr+yO8Wfhw2YUkr9mqxJexJWHXuGdHON18S+jl56ILNa\nlIMEXl1zsCleTLoTu/5ekRfeE+syPJ778LZXphbpDkK4qHzq+IXD\n-----END RSA PRIVATE KEY-----",
        },
        $host: {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
      ],
    },
    {
      title: "Home Address",
      uid: "1SYWtodrSwLT-NMPbgmOAw",
      notes: "Primary residence - mailing and billing address",
      $type: "address",
      last_modified: 1762428779,
      custom_fields: {
        $address: {
          street1: "742 Evergreen Terrace",
          street2: "Apt 3B",
          city: "Springfield",
          state: "Oregon",
          zip: "97477",
          country: "US",
        },
      },
      folders: [
        {
          folder: "Personal\\Finance\\Banking",
        },
      ],
    },
    {
      title: "Important Meeting Notes",
      uid: "99LoIjsFFORlHF5_UUHKNQ",
      notes: "Confidential meeting with executive team - requires follow-up by end of month",
      $type: "encryptedNotes",
      last_modified: 1762428779,
      custom_fields: {
        $note:
          "Q4 2024 Strategic Planning - Discussed budget allocations, team restructuring, and new product launch timeline",
        $date: 1728943200000,
      },
      folders: [
        {
          folder: "Personal\\Finance",
        },
      ],
    },
    {
      title: "John Doe Birth Certificate",
      uid: "MLzeGEnAH8eDyGwlBTqlWg",
      notes: "Official birth certificate for identification purposes",
      $type: "birthCertificate",
      last_modified: 1762428779,
      custom_fields: {
        $name: {
          first: "John",
          middle: "Michael",
          last: "Doe",
        },
        $birthDate: 642722400000,
      },
      folders: [
        {
          folder: "Work\\Documents",
        },
      ],
    },
    {
      title: "Dr. Emily Chen",
      uid: "EeEt6WFPj-6BLXuQ-P9Hmg",
      notes: "Primary care physician - office visits and consultations",
      $type: "contact",
      last_modified: 1762428779,
      custom_fields: {
        $name: {
          first: "Emily",
          middle: "Marie",
          last: "Chen",
        },
        "$text:company": "Springfield Medical Center",
        $email: "emily.chen@smc.org",
        $phone: {
          number: "5415558723",
        },
      },
      folders: [
        {
          folder: "Work\\Projects",
        },
      ],
    },
    {
      title: "Project Proposal Document",
      uid: "W7imwL473cSm6PLxEwDD6A",
      notes: "Annual project proposal for Q1 2025 business development initiatives",
      $type: "file",
      last_modified: 1762428779,
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
      ],
    },
    {
      title: "Blue Cross Blue Shield",
      uid: "omEu7bcqCHfrDS1-tLDjRg",
      login: "david.martinez@email.com",
      password: "Health$ecure789",
      login_url: "https://www.bcbs.com",
      notes: "PPO plan with nationwide coverage - family deductible $2500",
      $type: "healthInsurance",
      last_modified: 1762428779,
      custom_fields: {
        $accountNumber: "BCBS-12345678",
        "$name:insuredsName": {
          first: "David",
          middle: "Alan",
          last: "Martinez",
        },
      },
      folders: [
        {
          folder: "Work\\Projects\\2025\\Q4",
        },
      ],
    },
    {
      title: "Web Server - Production",
      uid: "bTkzcfnjSiYIbvVJnbCnvg",
      login: "sysadmin",
      password: "Srv#Prod2024!Sec",
      notes: "Primary production web server - Apache 2.4.52 - Ubuntu 22.04",
      $type: "serverCredentials",
      last_modified: 1762428779,
      custom_fields: {
        $host: {
          hostName: "web01.company.com",
          port: "22",
        },
      },
      folders: [
        {
          folder: "Clients\\Enterprise\\North America\\TechCorp",
        },
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
      ],
    },
    {
      title: "Chase Visa",
      uid: "lC3AmTzFJujKhAeASV5cZQ",
      notes: "Primary credit card for everyday purchases and rewards",
      $type: "bankCard",
      last_modified: 1762428779,
      custom_fields: {
        $paymentCard: {
          cardNumber: "4532123456789010",
          cardExpirationDate: "06/2030",
          cardSecurityCode: "347",
        },
        "$text:cardholderName": "Sarah Johnson",
        $pinCode: "8426",
      },
      folders: [
        {
          folder: "Work\\Projects\\2025\\Q4",
        },
      ],
    },
    {
      title: "Adobe Creative Cloud",
      uid: "HX7eAAQNOPRR1NJD_CLUQA",
      notes: "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
      $type: "softwareLicense",
      last_modified: 1762428779,
      custom_fields: {
        $licenseNumber: "ACDB-7849-2635-1947-8520",
        $expirationDate: 1767135600000,
        "$date:dateActive": 1705273200000,
      },
      folders: [
        {
          folder: "Clients\\Enterprise",
        },
      ],
    },
    {
      title: "Amazon Account",
      uid: "fZuZy2b5jZa4xcmbZgs7ng",
      login: "john.martinez@email.com",
      password: "Sp@rkl3Sun!2024",
      login_url: "https://www.amazon.com",
      notes: "Primary Amazon account for online shopping and Prime membership",
      $type: "login",
      last_modified: 1762428779,
      custom_fields: {
        $oneTimeCode:
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
        $url: ["https://login.amazon.com", "https://logout.amazon.com"],
        "$url:account": "https://account.amazon.com",
        "$url:profile url": "https://profile.amazon.com",
      },
      folders: [
        {
          folder: "Education",
        },
      ],
    },
  ],
};
