export const CliTestData = {
  shared_folders: [
    {
      path: "CanManageRecords-CanEdit",
      uid: "CFLPLcHQXbX2qSrgqkqt9g",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "CanManageUsers-ViewOnly",
      uid: "xYJco2_HFN5utJF81qtekQ",
      manage_users: true,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "FullAccess-CanShare",
      uid: "1fU3j7Cs8-CfSKI56e5S_g",
      manage_users: true,
      manage_records: true,
      can_edit: false,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "NoUserPerms-EditAndShare",
      uid: "DA1cYurScJXcLGPRypmc1w",
      manage_users: false,
      manage_records: false,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "Empty Folder\\Empty Nested Folder Level 2\\Empty Nested Folder Level 3\\Shared Folder Inside Empty Nested Folder",
      uid: "ZZ4TJ59za95ZE4avj7MRpQ",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      path: "Clients\\Enterprise\\North America\\TechCorp\\Shared-Needsted-Deep-Inside-Normal-Folder",
      uid: "biAMXHURzJSRz_REFaaEzg",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
  ],
  records: [
    {
      title: "US Passport",
      uid: "mV5sP_wtaQ-J-tTbOeRF5A",
      password: "Passport2023!Secure",
      notes: "Valid US passport for international travel",
      $type: "passport",
      last_modified: 1764674791,
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
      title: "Project Proposal Document",
      uid: "zCwzLOwtHO6I-ImMEDEGeg",
      notes: "Annual project proposal for Q1 2025 business development initiatives",
      $type: "file",
      last_modified: 1764674791,
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
      ],
    },
    {
      title: "Chase Visa",
      uid: "62Vj29V4-0gFyJBGgtppqA",
      login_url: "https://bank.card/test",
      notes: "Primary credit card for everyday purchases and rewards",
      $type: "bankCard",
      last_modified: 1765279737,
      custom_fields: {
        $paymentCard: {
          cardNumber: "4532123456789010",
          cardExpirationDate: "06/2030",
          cardSecurityCode: "347",
        },
        "$text:cardholderName": "Sarah Johnson",
        $pinCode: "8426",
        "$url:URL label": "https://bank.card/test/with/label",
      },
      folders: [
        {
          folder: "Work\\Projects\\2025\\Q4",
        },
      ],
    },
    {
      title: "Family Vacation 2024",
      uid: "XNMD_fR17J6t7uA01LiRqA",
      notes: "Summer vacation photos from Hawaii trip - scenic beach views",
      $type: "photo",
      last_modified: 1764674791,
      folders: [
        {
          folder: "Work",
        },
      ],
    },
    {
      title: "Oregon Driver's License",
      uid: "gO-E0lF62h9EyBZzdriCIg",
      notes: "Valid Oregon driver's license - Class C",
      $type: "driverLicense",
      last_modified: 1764674791,
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
      title: "Adobe Creative Cloud",
      uid: "leKO1ocZj-_-VKo6elepFQ",
      notes: "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
      $type: "softwareLicense",
      last_modified: 1764674791,
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
      title: "Dr. Emily Chen",
      uid: "Cc7XJclmnKeOqdFnG4Dz2A",
      notes: "Primary care physician - office visits and consultations",
      $type: "contact",
      last_modified: 1764695948,
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
          region: "AF",
          ext: "5577",
          type: "Work",
        },
      },
      references: {
        $address: ["1tjq4jlAla4S6GsBZpc8LQ"],
        $card: ["62Vj29V4-0gFyJBGgtppqA"],
      },
      folders: [
        {
          folder: "Work\\Projects",
        },
      ],
    },
    {
      title: "Home Address",
      uid: "O5Fua1ytoHF1c40mPGfwcA",
      notes: "Primary residence - mailing and billing address",
      $type: "address",
      last_modified: 1764674791,
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
      title: "Web Server - Production",
      uid: "ILgY7YlMizYMg7Z5XAc4HQ",
      login: "sysadmin",
      password: "Srv#Prod2024!Sec",
      notes: "Primary production web server - Apache 2.4.52 - Ubuntu 22.04",
      $type: "serverCredentials",
      last_modified: 1764674791,
      custom_fields: {
        $host: {
          hostName: "web01.company.com",
          port: "22",
        },
      },
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
        {
          folder: "Clients\\Enterprise\\North America\\TechCorp",
        },
      ],
    },
    {
      title: "Production MySQL Database",
      uid: "fE_fVT4JHgkk_unIkOcDAw",
      login: "db_admin",
      password: "SecureDb#2024$Pass",
      notes: "Production database server for main application - handle with care",
      $type: "databaseCredentials",
      last_modified: 1764674791,
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
      title: "Important Meeting Notes",
      uid: "n6ik4Bl8aeLVSiE8DyGh1A",
      notes: "Confidential meeting with executive team - requires follow-up by end of month",
      $type: "encryptedNotes",
      last_modified: 1764674791,
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
      title: "National Identity Card",
      uid: "vFSao19hayaD-okllcPwLw",
      notes: "National identification card - Valid through 2028",
      $type: "ssnCard",
      last_modified: 1764674791,
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
      title: "Wells Fargo Checking",
      uid: "FLrhKWqZ2o3gRsEenMNvQA",
      login: "m.thompson@email.com",
      password: "BankS3cur3!Pass",
      notes: "Primary checking account for direct deposit and bill payments",
      $type: "bankAccount",
      last_modified: 1764674791,
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
      title: "Production Server SSH Key",
      uid: "UKm6IByDXF41y7du_gjhtA",
      login: "deploy_user",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      last_modified: 1764674791,
      custom_fields: {
        $keyPair: {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDNKtrfeBybhjHLGE9DD5ZlNol/g0Z2RSyKZa4DDFt2ZjuMYw6nx0OZggrRX6PbCYblkAtbSC2erLvNsZFgkLRyuTrmBydYpe1i9Eoig5Sk1okyOrenDfoWfuVlWJNWVj63wUm8+adobX+hOd8vzuQt818d9sEEwMA9SONevmJdQ1+YsE0M3Na+MqGyoqZaP6Gtoh+yOIiIuk2EyRS6CI7gbv6HkapU/+jh4anTaXsVA/xN0AkjuVk5dE1Znw//ThgfVbUPXsApFzoTsAs7eq4z2K21hHv6SVrGiqoTIgHTEIpxLi/Yaitkl5uPQRaAr/llPevFNkt3xeNkAAg//s5DkaQkT5QRwbN6ZiQf7eWwjRU3SIXr5uvYc7gJx7cJfpyHyZQtTyCq8OFDAIXMrTTaKNGSa/Z/kgeJUydgoP/TRLaRjZaTWB6VdPyIZyG1u/eQdbnTHVl0K51Dy0VXSVcoj1HWZPEMZHwymzYHspF7NO5pJ2/4L3B8H8QtRMT58ooUNlPAHuKHnXInNMYm8XBX6eE1KNoiaQilx9j7A95mkI6Njh0Fi+sXt9qZSLbjQ4k7oBNh/yqqMkJEZH/TbppNTf9KGjxBYgfeiHjnFA9GztlQ2XvspklIPXF8VdcxtwXSQ2tBe8TyWMbwlKNYEURoNVpB7H120MssS9JCrEdZ2Q== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAgEAzSra33gcm4YxyxhPQw+WZTaJf4NGdkUsimWuAwxbdmY7jGMOp8dD\nmYIK0V+j2wmG5ZALW0gtnqy7zbGRYJC0crk65gcnWKXtYvRKIoOUpNaJMjq3pw36Fn7lZV\niTVlY+t8FJvPmnaG1/oTnfL87kLfNfHfbBBMDAPUjjXr5iXUNfmLBNDNzWvjKhsqKmWj+h\nraIfsjiIiLpNhMkUugiO4G7+h5GqVP/o4eGp02l7FQP8TdAJI7lZOXRNWZ8P/04YH1W1D1\n7AKRc6E7ALO3quM9ittYR7+klaxoqqEyIB0xCKcS4v2GorZJebj0EWgK/5ZT3rxTZLd8Xj\nZAAIP/7OQ5GkJE+UEcGzemYkH+3lsI0VN0iF6+br2HO4Cce3CX6ch8mULU8gqvDhQwCFzK\n002ijRkmv2f5IHiVMnYKD/00S2kY2Wk1gelXT8iGchtbv3kHW50x1ZdCudQ8tFV0lXKI9R\n1mTxDGR8Mps2B7KRezTuaSdv+C9wfB/ELUTE+fKKFDZTwB7ih51yJzTGJvFwV+nhNSjaIm\nkIpcfY+wPeZpCOjY4dBYvrF7famUi240OJO6ATYf8qqjJCRGR/026aTU3/Sho8QWIH3oh4\n5xQPRs7ZUNl77KZJSD1xfFXXMbcF0kNrQXvE8ljG8JSjWBFEaDVaQex9dtDLLEvSQqxHWd\nkAAAdIximVrcYpla0AAAAHc3NoLXJzYQAAAgEAzSra33gcm4YxyxhPQw+WZTaJf4NGdkUs\nimWuAwxbdmY7jGMOp8dDmYIK0V+j2wmG5ZALW0gtnqy7zbGRYJC0crk65gcnWKXtYvRKIo\nOUpNaJMjq3pw36Fn7lZViTVlY+t8FJvPmnaG1/oTnfL87kLfNfHfbBBMDAPUjjXr5iXUNf\nmLBNDNzWvjKhsqKmWj+hraIfsjiIiLpNhMkUugiO4G7+h5GqVP/o4eGp02l7FQP8TdAJI7\nlZOXRNWZ8P/04YH1W1D17AKRc6E7ALO3quM9ittYR7+klaxoqqEyIB0xCKcS4v2GorZJeb\nj0EWgK/5ZT3rxTZLd8XjZAAIP/7OQ5GkJE+UEcGzemYkH+3lsI0VN0iF6+br2HO4Cce3CX\n6ch8mULU8gqvDhQwCFzK002ijRkmv2f5IHiVMnYKD/00S2kY2Wk1gelXT8iGchtbv3kHW5\n0x1ZdCudQ8tFV0lXKI9R1mTxDGR8Mps2B7KRezTuaSdv+C9wfB/ELUTE+fKKFDZTwB7ih5\n1yJzTGJvFwV+nhNSjaImkIpcfY+wPeZpCOjY4dBYvrF7famUi240OJO6ATYf8qqjJCRGR/\n026aTU3/Sho8QWIH3oh45xQPRs7ZUNl77KZJSD1xfFXXMbcF0kNrQXvE8ljG8JSjWBFEaD\nVaQex9dtDLLEvSQqxHWdkAAAADAQABAAACAA+9jfU/HdLAxOk0AEDA3WT+fiYOSEWioPwt\nOOB6/jljNoZawzEUFJeeZn4RvFx9qp/KIVTrgLR/xBjP2rtx3qY+l8o2Gkqu0DubSmTDe4\n/59aSo5JYoeFtpeOgBl6w0CbPHXITnEnTskbIo4nqkgNUVquJ9n+lhcF5DTU5jhOBq3ta0\nD/VArCkDcWxnFiQuZZUQryXZOIBk6rWZR8HODkghu91iy5Kh35gU3BagLRU7rQu7PjhDbB\nkAVz7c+Tk5IJim1rFLL6r3YTlJdFMn4l2P7iPS+kAFiLVaxhmZrlInHrf4Nyt/Wbzp9MFU\n2Qkedx/RVFlZBQk3YW62oetm/SQGxcqad50vj44t4THa+IfvVRvdTQEUmMAV5vw4Pr8tDV\n6Bdnau+nJ4Bu4TS0wGLmp7Su/luCgiXb7Upl4JnnJFuftPOrHTRfmvVdxMEdsoN3/4PHPt\np6XY/rjJTOVkm5KXRQ8bicinaUExb4GwXpraz/OC/HsYfR1ERqQJ+4ZxHrAN/JmBdpc4HE\nZVip/3GJ70+H+cxWgvpte5CSjGpnkZmog+bjnyDKXYNNWb9dWViz7lMomWA+mql3hQ+oa/\n4FbC/UQUy48cpIXvTSprWswpiM+YJIa8Xr1Ox20OVPH/Z+tvIV1fC8vC/pAYlqCjzuO/qJ\nIeNMOL02Kbtv9PNKURAAABAQDCQIGDNLEyAN4VszXk8v9OCo1oD9K6iw7yz77OMgnWGDcI\nJTie+eJpp6BYV9JRMohBI6EuAaayJODN3e99g18AwD+2bq9rwIgUz40qgb0exqXQfFsxPL\njHbiqTt9ztXn1iAGvABdeGKU2v2I5BWnDBiKp4dtSs6VCJn9GT06MC1YJMSO5BugdWW7h3\nJgQyal/0iUoAV1mc1E2+mUtp9MkACs3Z9GvqNPL118aJEpwrfX8qpYrhYVIYVwmIsqD2gM\nFTNu2t8qbVF+e+flwWXY11EpV3CZMe1uNAi6zXJeXorV4zP4glFhSztqdORgVjyVp84AVW\nc7lZpwkGHr2E6CGvAAABAQDsUqsNCNBSX+SzKcc4XmT9mKZj8eoy4Bhx5cf+4YeXqoXpxY\nPtzSsP/1Tu8tZGJo4dwT8bjITNb3lWoFiSn4wO7qKfcE6EjEIF7fq1AKcDmaVOwTMnfRm9\nJm1fD3g3SMk6FSYyN1Ud1SbOOj7kD6grVs7Y9NI221GJV1wxRmVKxpIZn+3v3MTw1G+XMS\nm1zbTjkFnaT15nMIIL5RldqxhKkHabQiIKEZhBm0NMMNerRUOPBnQtu3B54rzvw+onvgo5\n1QO2BtonNCM3UEvSFNFJzrgw/QmeEtWGXAoM0BVpQKqrd4OMmXfHyYdLu/u+Sm6E4Szqdd\n1iWkeXzoX5u7GbAAABAQDeQBexoRCZPhym/m7mSQfz1mu0REEp3x0l6paLye2l80B1ClOQ\n7MgNNYbnWMAnY8zfaI0et+MD1h4e4oqaQ/mbZObtB3ZrTt2m4fiEzp1hRNvkJjx3nQpcTz\nyonJUQyPceRE5pQsTcPr3dpeJ5XMw+mr40abs0PoWNeAB/QKWGtp4uy3isEIUIFcB77elj\n7hcHkMasLGwtEc6cVyzPLJkDNgB/QRtLv29UTbQJYes+nPIjTpG8YZizoZIGAI7u7QgNPU\nM7SpasFJFfQcXLyzwSILzcbDUPrEgSsXVAKyQ6h00dgxe6KLAwvobbzqfB/q6c58hKYr/k\nni999oyFigObAAAAD2dlbmVyYXRlZEBsb2NhbAECAw==\n-----END OPENSSH PRIVATE KEY-----\n",
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
      title: "Blue Cross Blue Shield",
      uid: "sebchxPx9UNKczqwugiLfA",
      login: "david.martinez@email.com",
      password: "Health$ecure789",
      login_url: "https://www.bcbs.com",
      notes: "PPO plan with nationwide coverage - family deductible $2500",
      $type: "healthInsurance",
      last_modified: 1764674791,
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
      title: "Home Wi-Fi",
      uid: "yfBlFdjYKtWgqImVbMvxIQ",
      password: "secure-password-123",
      notes: "My cozy home wi-fi",
      $type: "wifiCredentials",
      last_modified: 1764680788,
      custom_fields: {
        "$text:SSID": "cozy-home-netz",
      },
    },
    {
      title: "John Doe Birth Certificate",
      uid: "MC6-26aDdCglT0uRV16ZUg",
      notes: "Official birth certificate for identification purposes",
      $type: "birthCertificate",
      last_modified: 1764674791,
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
      title: "Amazon Account",
      uid: "B0GyTcC71YishCJ2elVOPA",
      login: "john.martinez@email.com",
      password: "Sp@rkl3Sun!2024",
      login_url: "https://www.amazon.com",
      notes: "Primary Amazon account for online shopping and Prime membership",
      $type: "login",
      last_modified: 1764675071,
      custom_fields: {
        $oneTimeCode:
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
        $url: ["https://login.amazon.com", "https://logout.amazon.com"],
        "$url:account": "https://account.amazon.com",
        "$url:profile url": "https://profile.amazon.com",
        "$text:some label": "some text",
        $securityQuestion: {
          question: "how old were you when you were born?",
          answer: "zero",
        },
        "$multiline:some more text": "some lines\nsome more lines\nblah blah blah",
        $appFiller: {
          applicationTitle: "notepad.exe",
          contentFilter: "not-sure",
          macroSequence: "{USERNAME}{TAB}{ENTER}",
        },
        "$securityQuestion:Q&A": [
          {
            question: "how are you?",
            answer: "good, thanks!",
          },
          {
            question: "how old are you?",
            answer: "five",
          },
        ],
        "$date:some date": 1764535848918,
        $email: "blah@blah.com",
        "$name:someone": {
          first: "Maria",
          middle: "",
          last: "Smith",
        },
        "$pinCode:pin-pin-pin": "1234",
        $phone: [
          {
            region: "AZ",
            number: "123123123",
            type: "Home",
          },
          {
            region: "CZ",
            number: "555555555",
            ext: "444",
          },
        ],
        "$secret:special secret": "big secret",
      },
      references: {
        $address: ["O5Fua1ytoHF1c40mPGfwcA", "1tjq4jlAla4S6GsBZpc8LQ"],
      },
      folders: [
        {
          folder: "Education",
        },
      ],
    },
    {
      title: "General Information Record",
      uid: "Zf0Rw6Uhvw5y_8X81lYiqg",
      login: "general_user@example.com",
      password: "GeneralPass#2024!Secure",
      login_url: "https://general.example.com",
      notes: "General purpose record for miscellaneous information and credentials",
      $type: "login",
      last_modified: 1764674791,
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
      title: "Invalid SSH key",
      uid: "W4PW7FP0LItdC3MWImPIgA",
      login: "deploy_user",
      password: "blah-blah-blah",
      notes: "Broken ssh key",
      $type: "sshKeys",
      last_modified: 1764674791,
      custom_fields: {
        $keyPair: {
          publicKey: "blah blah public key",
          privateKey: "blah blah blah private key",
        },
        $host: {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
    },
    {
      title: "LA Fitness Gym",
      uid: "tkEIKU0XPOLYNZvaBDuYKw",
      password: "FitLife2024!Strong",
      notes: "Annual membership - full gym access including pool and classes",
      $type: "membership",
      last_modified: 1764674791,
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
      title: "Other bank",
      uid: "R7dA46QV3lQSzKmMuapAfQ",
      $type: "bankAccount",
      last_modified: 1764674791,
      custom_fields: {
        $bankAccount: {
          accountType: "Other",
          routingNumber: "",
          accountNumber: "12345678",
          otherType: "Crypto",
        },
        $name: {
          first: "Mark",
          last: "Zwei",
        },
      },
    },
    {
      title: "Production Server SSH Key with a passphrase",
      uid: "ix1JbB74OKECp88izZCIvA",
      login: "deploy_user",
      password: "blah-blah-blah",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      last_modified: 1764674791,
      custom_fields: {
        $keyPair: {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDGLWOv9FqwmTvKgHse41BtJmvutu6RG9WI1aSWjTJ1DSaZqYnGSeShHN4tg4sBXdiCq2sFASQ+rkbzhA/aQCqhsvQKIHMOcHIT2L2MKe5SfDfjb26krV7rRCjhaUyAiEX1mLc3UdfonL88zWGKUCiH8W7Ael/726VQJbW8eURJb2yLQNO8UaqobzXbQVoD015G9oxdrV3NbzCI87uwY//2ak9TOfgYjWzvTTjo3yZZhqaMUdqrtSUYVhM9tA+c8/BlWJis5lKy1R+ZsbTpPcESwuA4IVI5sqPaeVbQa/iUwiyv3T45TLt+pNp0gdGWbtm7rN88Ni9id7yq0+wEkGKSCvbCdUvHR4eQPhn0F/jUupzYvwIJ5o2k7XVg1KwsCJiTK+5ZaChjdzlXCBgmzQwWPcXic/EVTjaVoGhXJUdZnNwFTdgQEGf6tkngSFIBnLUyR9fV1zmwXUfLpT/yrqVJtiUDaupoa/3TvJSVH1IVut05p7WYB/oHL+TxIrp8PF6KdiB6VVmkkknf4mV+QdmeVYMXPX66yn9ctt8NCMkTffcN0D8SD2rRwQLRyyA3HrqtUkyQnsAhJ81r6ur3S5sgSwACCpix+F64bBLeatmke7hV7qvdXIKKRB/NDNaNN9i6leyAtjYLyE5ydWdOHI/Dywuj87JXl6TKRN9TOKb3pw== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\n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\n203O/Ve2/iEoB1CDJQVO7iWcE=\n-----END OPENSSH PRIVATE KEY-----\n",
        },
        $host: {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
    },
    {
      title: "Office",
      uid: "1tjq4jlAla4S6GsBZpc8LQ",
      $type: "address",
      last_modified: 1764675057,
      custom_fields: {
        $address: {
          country: "US",
          street1: "1428 Elm Street",
          street2: "Suite 200",
          city: "Portland",
          state: "Oregon",
          zip: "97204",
        },
      },
    },
  ],
};

export const WebTestData = {
  shared_folders: [
    {
      uid: "CFLPLcHQXbX2qSrgqkqt9g",
      path: "CanManageRecords-CanEdit",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "DA1cYurScJXcLGPRypmc1w",
      path: "NoUserPerms-EditAndShare",
      manage_users: false,
      manage_records: false,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "ZZ4TJ59za95ZE4avj7MRpQ",
      path: "Empty Folder\\Empty Nested Folder Level 2\\Empty Nested Folder Level 3\\Shared Folder Inside Empty Nested Folder",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "biAMXHURzJSRz_REFaaEzg",
      path: "Clients\\Enterprise\\North America\\TechCorp\\Shared-Needsted-Deep-Inside-Normal-Folder",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "xYJco2_HFN5utJF81qtekQ",
      path: "CanManageUsers-ViewOnly",
      manage_users: true,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "1fU3j7Cs8-CfSKI56e5S_g",
      path: "FullAccess-CanShare",
      manage_users: true,
      manage_records: true,
      can_edit: false,
      can_share: true,
      permissions: [
        {
          name: "lastpass.ruby+02-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
  ],
  records: [
    {
      uid: 1,
      title: "Adobe Creative Cloud",
      notes: "Annual subscription - full access to Photoshop, Illustrator, Premiere Pro",
      $type: "softwareLicense",
      custom_fields: {
        "$licenseNumber::1": "ACDB-7849-2635-1947-8520",
        "$expirationDate::1": 1767135600000,
        "$date:dateActive:1": 1705273200000,
      },
      folders: [
        {
          folder: "Clients\\Enterprise",
        },
      ],
    },
    {
      uid: 2,
      title: "Amazon Account",
      notes: "Primary Amazon account for online shopping and Prime membership",
      $type: "login",
      custom_fields: {
        "$oneTimeCode::1":
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
        "$url::1": ["https://login.amazon.com", "https://logout.amazon.com"],
        "$url:account:1": "https://account.amazon.com",
        "$url:profile url:1": "https://profile.amazon.com",
        "$text:some label:1": "some text",
        "$securityQuestion::1": {
          question: "how old were you when you were born?",
          answer: "zero",
        },
        "$multiline:some more text:1": "some lines\nsome more lines\nblah blah blah",
        "$appFiller::1": {
          applicationTitle: "notepad.exe",
          contentFilter: "not-sure",
          macroSequence: "{USERNAME}{TAB}{ENTER}",
        },
        "$securityQuestion:Q&A:1": [
          {
            question: "how are you?",
            answer: "good, thanks!",
          },
          {
            question: "how old are you?",
            answer: "five",
          },
        ],
        "$date:some date:1": 1764535848918,
        "$email::1": "blah@blah.com",
        "$name:someone:1": {
          first: "Maria",
          middle: "",
          last: "Smith",
        },
        "$pinCode:pin-pin-pin:1": "1234",
        "$phone::1": [
          {
            region: "AZ",
            number: "123123123",
            type: "Home",
          },
          {
            region: "CZ",
            number: "555555555",
            ext: "444",
          },
        ],
        "$secret:special secret:1": "big secret",
      },
      login: "john.martinez@email.com",
      password: "Sp@rkl3Sun!2024",
      login_url: "https://www.amazon.com",
      references: {
        "$addressRef::1": [8],
        "$addressRef::2": [15],
      },
      folders: [
        {
          folder: "Education",
        },
      ],
    },
    {
      uid: 3,
      title: "Blue Cross Blue Shield",
      notes: "PPO plan with nationwide coverage - family deductible $2500",
      $type: "healthInsurance",
      custom_fields: {
        "$accountNumber::1": "BCBS-12345678",
        "$name:insuredsName:1": {
          first: "David",
          middle: "Alan",
          last: "Martinez",
        },
      },
      login: "david.martinez@email.com",
      password: "Health$ecure789",
      login_url: "https://www.bcbs.com",
      folders: [
        {
          folder: "Work\\Projects\\2025\\Q4",
        },
      ],
    },
    {
      uid: 4,
      title: "Chase Visa",
      notes: "Primary credit card for everyday purchases and rewards",
      $type: "bankCard",
      custom_fields: {
        "$paymentCard::1": {
          cardNumber: "4532123456789010",
          cardExpirationDate: "06/2030",
          cardSecurityCode: "347",
        },
        "$text:cardholderName:1": "Sarah Johnson",
        "$pinCode::1": "8426",
        "$url:URL label:1": "https://bank.card/test/with/label",
      },
      login_url: "https://bank.card/test",
      folders: [
        {
          folder: "Work\\Projects\\2025\\Q4",
        },
      ],
    },
    {
      uid: 5,
      title: "Dr. Emily Chen",
      notes: "Primary care physician - office visits and consultations",
      $type: "contact",
      custom_fields: {
        "$name::1": {
          first: "Emily",
          middle: "Marie",
          last: "Chen",
        },
        "$text:company:1": "Springfield Medical Center",
        "$email::1": "emily.chen@smc.org",
        "$phone::1": {
          number: "5415558723",
          region: "AF",
          ext: "5577",
          type: "Work",
        },
      },
      references: {
        "$addressRef::1": [15],
        "$cardRef::1": [4],
      },
      folders: [
        {
          folder: "Work\\Projects",
        },
      ],
    },
    {
      uid: 6,
      title: "Family Vacation 2024",
      notes: "Summer vacation photos from Hawaii trip - scenic beach views",
      $type: "photo",
      folders: [
        {
          folder: "Work",
        },
      ],
    },
    {
      uid: 7,
      title: "General Information Record",
      notes: "General purpose record for miscellaneous information and credentials",
      $type: "login",
      custom_fields: {
        "$oneTimeCode::1":
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
      },
      login: "general_user@example.com",
      password: "GeneralPass#2024!Secure",
      login_url: "https://general.example.com",
      folders: [
        {
          folder: "Personal\\Finance\\Banking\\Accounts",
        },
      ],
    },
    {
      uid: 8,
      title: "Home Address",
      notes: "Primary residence - mailing and billing address",
      $type: "address",
      custom_fields: {
        "$address::1": {
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
      uid: 9,
      title: "Home Wi-Fi",
      notes: "My cozy home wi-fi",
      $type: "wifiCredentials",
      schema: [
        "$text:SSID:1",
        "$password::1",
        "$wifiEncryption::1",
        "$isSSIDHidden::1",
        "$fileRef::1",
      ],
      custom_fields: {
        "$text:SSID:1": "cozy-home-netz",
      },
      password: "secure-password-123",
    },
    {
      uid: 10,
      title: "Important Meeting Notes",
      notes: "Confidential meeting with executive team - requires follow-up by end of month",
      $type: "encryptedNotes",
      custom_fields: {
        "$note::1":
          "Q4 2024 Strategic Planning - Discussed budget allocations, team restructuring, and new product launch timeline",
        "$date::1": 1728943200000,
      },
      folders: [
        {
          folder: "Personal\\Finance",
        },
      ],
    },
    {
      uid: 11,
      title: "Invalid SSH key",
      notes: "Broken ssh key",
      $type: "sshKeys",
      login: "deploy_user",
      custom_fields: {
        "$keyPair::1": {
          publicKey: "blah blah public key",
          privateKey: "blah blah blah private key",
        },
        "$host::1": {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
      password: "blah-blah-blah",
    },
    {
      uid: 12,
      title: "John Doe Birth Certificate",
      notes: "Official birth certificate for identification purposes",
      $type: "birthCertificate",
      custom_fields: {
        "$name::1": {
          first: "John",
          middle: "Michael",
          last: "Doe",
        },
        "$birthDate::1": 642722400000,
      },
      folders: [
        {
          folder: "Work\\Documents",
        },
      ],
    },
    {
      uid: 13,
      title: "LA Fitness Gym",
      notes: "Annual membership - full gym access including pool and classes",
      $type: "membership",
      custom_fields: {
        "$accountNumber::1": "LAF-987654321",
        "$name::1": {
          first: "Lisa",
          middle: "Marie",
          last: "Rodriguez",
        },
      },
      password: "FitLife2024!Strong",
      folders: [
        {
          folder: "Personal\\Finance\\Banking",
        },
      ],
    },
    {
      uid: 14,
      title: "National Identity Card",
      notes: "National identification card - Valid through 2028",
      $type: "ssnCard",
      custom_fields: {
        "$accountNumber:identityNumber:1": "ID-7849521",
        "$name::1": {
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
      uid: 15,
      title: "Office",
      $type: "address",
      custom_fields: {
        "$address::1": {
          country: "US",
          street1: "1428 Elm Street",
          street2: "Suite 200",
          city: "Portland",
          state: "Oregon",
          zip: "97204",
        },
      },
    },
    {
      uid: 16,
      title: "Oregon Driver's License",
      notes: "Valid Oregon driver's license - Class C",
      $type: "driverLicense",
      custom_fields: {
        "$accountNumber:dlNumber:1": "DL-7482693",
        "$name::1": {
          first: "Robert",
          middle: "William",
          last: "Anderson",
        },
        "$birthDate::1": 479689200000,
        "$expirationDate::1": 1836687600000,
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
      uid: 17,
      title: "Other bank",
      $type: "bankAccount",
      custom_fields: {
        "$bankAccount::1": {
          accountType: "Other",
          routingNumber: "",
          accountNumber: "12345678",
          otherType: "Crypto",
        },
        "$name::1": {
          first: "Mark",
          last: "Zwei",
        },
      },
    },
    {
      uid: 18,
      title: "Production MySQL Database",
      notes: "Production database server for main application - handle with care",
      $type: "databaseCredentials",
      custom_fields: {
        "$text:type:1": "MySQL",
        "$host::1": {
          hostName: "db.production.company.com",
          port: "3306",
        },
      },
      login: "db_admin",
      password: "SecureDb#2024$Pass",
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
      uid: 19,
      title: "Production Server SSH Key",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      login: "deploy_user",
      custom_fields: {
        "$keyPair::1": {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDNKtrfeBybhjHLGE9DD5ZlNol/g0Z2RSyKZa4DDFt2ZjuMYw6nx0OZggrRX6PbCYblkAtbSC2erLvNsZFgkLRyuTrmBydYpe1i9Eoig5Sk1okyOrenDfoWfuVlWJNWVj63wUm8+adobX+hOd8vzuQt818d9sEEwMA9SONevmJdQ1+YsE0M3Na+MqGyoqZaP6Gtoh+yOIiIuk2EyRS6CI7gbv6HkapU/+jh4anTaXsVA/xN0AkjuVk5dE1Znw//ThgfVbUPXsApFzoTsAs7eq4z2K21hHv6SVrGiqoTIgHTEIpxLi/Yaitkl5uPQRaAr/llPevFNkt3xeNkAAg//s5DkaQkT5QRwbN6ZiQf7eWwjRU3SIXr5uvYc7gJx7cJfpyHyZQtTyCq8OFDAIXMrTTaKNGSa/Z/kgeJUydgoP/TRLaRjZaTWB6VdPyIZyG1u/eQdbnTHVl0K51Dy0VXSVcoj1HWZPEMZHwymzYHspF7NO5pJ2/4L3B8H8QtRMT58ooUNlPAHuKHnXInNMYm8XBX6eE1KNoiaQilx9j7A95mkI6Njh0Fi+sXt9qZSLbjQ4k7oBNh/yqqMkJEZH/TbppNTf9KGjxBYgfeiHjnFA9GztlQ2XvspklIPXF8VdcxtwXSQ2tBe8TyWMbwlKNYEURoNVpB7H120MssS9JCrEdZ2Q== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\n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\n-----END OPENSSH PRIVATE KEY-----\n",
        },
        "$host::1": {
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
      uid: 20,
      title: "Production Server SSH Key with a passphrase",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      login: "deploy_user",
      custom_fields: {
        "$keyPair::1": {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDGLWOv9FqwmTvKgHse41BtJmvutu6RG9WI1aSWjTJ1DSaZqYnGSeShHN4tg4sBXdiCq2sFASQ+rkbzhA/aQCqhsvQKIHMOcHIT2L2MKe5SfDfjb26krV7rRCjhaUyAiEX1mLc3UdfonL88zWGKUCiH8W7Ael/726VQJbW8eURJb2yLQNO8UaqobzXbQVoD015G9oxdrV3NbzCI87uwY//2ak9TOfgYjWzvTTjo3yZZhqaMUdqrtSUYVhM9tA+c8/BlWJis5lKy1R+ZsbTpPcESwuA4IVI5sqPaeVbQa/iUwiyv3T45TLt+pNp0gdGWbtm7rN88Ni9id7yq0+wEkGKSCvbCdUvHR4eQPhn0F/jUupzYvwIJ5o2k7XVg1KwsCJiTK+5ZaChjdzlXCBgmzQwWPcXic/EVTjaVoGhXJUdZnNwFTdgQEGf6tkngSFIBnLUyR9fV1zmwXUfLpT/yrqVJtiUDaupoa/3TvJSVH1IVut05p7WYB/oHL+TxIrp8PF6KdiB6VVmkkknf4mV+QdmeVYMXPX66yn9ctt8NCMkTffcN0D8SD2rRwQLRyyA3HrqtUkyQnsAhJ81r6ur3S5sgSwACCpix+F64bBLeatmke7hV7qvdXIKKRB/NDNaNN9i6leyAtjYLyE5ydWdOHI/Dywuj87JXl6TKRN9TOKb3pw== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\n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\n203O/Ve2/iEoB1CDJQVO7iWcE=\n-----END OPENSSH PRIVATE KEY-----\n",
        },
        "$host::1": {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
      password: "blah-blah-blah",
    },
    {
      uid: 21,
      title: "Project Proposal Document",
      notes: "Annual project proposal for Q1 2025 business development initiatives",
      $type: "file",
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
      ],
    },
    {
      uid: 22,
      title: "US Passport",
      notes: "Valid US passport for international travel",
      $type: "passport",
      custom_fields: {
        "$accountNumber:passportNumber:1": "543826194",
        "$name::1": {
          first: "Jennifer",
          middle: "Lynn",
          last: "Williams",
        },
        "$birthDate::1": 648597600000,
        "$expirationDate::1": 2005596000000,
        "$date:dateIssued:1": 1692050400000,
      },
      password: "Passport2023!Secure",
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes",
        },
      ],
    },
    {
      uid: 23,
      title: "Web Server - Production",
      notes: "Primary production web server - Apache 2.4.52 - Ubuntu 22.04",
      $type: "serverCredentials",
      custom_fields: {
        "$host::1": {
          hostName: "web01.company.com",
          port: "22",
        },
      },
      login: "sysadmin",
      password: "Srv#Prod2024!Sec",
      folders: [
        {
          folder: "Development\\Name/with\\\\both/slashes\\Android",
        },
        {
          folder: "Clients\\Enterprise\\North America\\TechCorp",
        },
      ],
    },
    {
      uid: 24,
      title: "Wells Fargo Checking",
      notes: "Primary checking account for direct deposit and bill payments",
      $type: "bankAccount",
      custom_fields: {
        "$bankAccount::1": {
          accountType: "Checking",
          routingNumber: "121000248",
          accountNumber: "8472651938",
          otherType: "",
        },
        "$name::1": {
          first: "Michael",
          middle: "James",
          last: "Thompson",
        },
        "$oneTimeCode::1":
          "otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E&issuer=&algorithm=SHA1&digits=6&period=30",
      },
      login: "m.thompson@email.com",
      password: "BankS3cur3!Pass",
      folders: [
        {
          folder: "Clients\\Enterprise\\North America\\TechCorp",
        },
      ],
    },
  ],
};

export const LegacyTestData = {
  shared_folders: [
    {
      uid: "Gbb4krqq9haSme7b51lI9Q",
      path: "New Marketing Folder",
      manage_users: true,
      manage_records: false,
      can_edit: true,
      can_share: true,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "QZ87hDVR1DtXTlCxUH4zFA",
      path: "abc",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "dexCPvCBpprSbIcf5m8NbA",
      path: "Dev build ",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "g8dg2-CHraaCm3ex_K2d4g",
      path: "Transferred: Account\\Test Item",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "ss2R66TmWKY9zu4ek4C1JQ",
      path: "Transferred: garrisonconsultinguser@gmail.com\\Marketing",
      manage_users: true,
      manage_records: false,
      can_edit: false,
      can_share: true,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "s2lQMqV6ssEoh6o0s4rGRw",
      path: "Personal\\Shared with Family",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "u-wf6fVSvBbJiTgwCWQSDA",
      path: "Inheritance",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "vo2kdOG7Oiyx8hln1_Rd9Q",
      path: "Shared Project Folder",
      manage_users: false,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "_f2bF-tGmMfI0XFcXH84xA",
      path: "Marketing",
      manage_users: true,
      manage_records: false,
      can_edit: false,
      can_share: false,
      permissions: [
        {
          name: "garrisonconsultingcorp@gmail.com",
          manage_users: true,
          manage_records: true,
        },
        {
          name: "jacksonfinch@altmails.com",
          manage_users: false,
          manage_records: false,
        },
        {
          name: "sarahsmith@altmails.com",
          manage_users: false,
          manage_records: false,
        },
      ],
    },
  ],
  records: [
    {
      uid: 1,
      title: "AARP",
      $type: "login",
      login_url: "https://aarp.org",
      folders: [
        {
          shared_folder: "Inheritance",
          folder: "Sub-inheritance",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 2,
      title: "abc 1",
      $type: "login",
    },
    {
      uid: 3,
      title: "Amazon Registration",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: ";G7hdwhK4+Z3em(>LE$!",
      login_url: "https://www.amazon.com/ap/register",
    },
    {
      uid: 4,
      title: "Amazon Registration",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: ";G7hdwhK4+Z3em(>LE$!",
      login_url: "https://www.amazon.com/ap/register",
    },
    {
      uid: 5,
      title: "Amazon Sign-In",
      $type: "login",
      login: "dflinn@bitwarden.com",
      password: "sSd{..Lj34+s,9F}Q(1S",
      login_url: "https://www.amazon.com/ap/signin",
    },
    {
      uid: 6,
      title: "cipher item",
      notes: "the quick brown fox jumps over the lazy dog.",
      $type: "login",
      custom_fields: {
        "$text:kasjdfiauefaikjsjdf8as7878:1": "custom",
      },
      login: "username123",
      password: "password123",
    },
    {
      uid: 7,
      title: "codepen",
      $type: "login",
      login: "test",
      password: "apple24",
      login_url: "codepen.io",
    },
    {
      uid: 8,
      title: "codepen1",
      $type: "login",
      login: "test",
      password: "S1IL@,zmH^)h{[R8g.ZB",
      login_url: "codepen.io",
    },
    {
      uid: 9,
      title: "codepen2",
      $type: "login",
      login: "test",
      password: "S1IL@,zmH^)h{[R8g.ZB",
      login_url: "codepen.io",
    },
    {
      uid: 10,
      title: "codepen3",
      $type: "login",
      login: "test",
      password: "S1IL@,zmH^)h{[R8g.ZB",
      login_url: "codepen.io",
    },
    {
      uid: 11,
      title: "codepen4",
      $type: "login",
      login: "test",
      password: "S1IL@,zmH^)h{[R8g.ZB",
      login_url: "codepen.io",
    },
    {
      uid: 12,
      title: "codepen5",
      $type: "login",
      login: "test",
      password: "S1IL@,zmH^)h{[R8g.ZB",
      login_url: "codepen.io",
    },
    {
      uid: 13,
      title: "Comp Test",
      $type: "login",
      login: "abc@gmail.com",
      password: "abc123",
      folders: [
        {
          shared_folder: "Dev build ",
          folder: "dfdfgh",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 14,
      title: "Comp Test",
      $type: "login",
    },
    {
      uid: 15,
      title: "Comp Test with OTP",
      $type: "login",
      login: "test",
      password: "l3}9%aI6Hh33k2CJcsXB",
      custom_fields: {
        "$oneTimeCode::1": [
          "otpauth://totp/Iterable:justin.tulk@iterable.com?secret=YW6CMSUJOHCE3H33&issuer=Iterable",
          "otpauth://totp/Google%3Asbolina%40bitwarden.com?secret=6whhjvsb3taxmlf4e7fk4v7lsusuv2m5&issuer=Google",
        ],
      },
    },
    {
      uid: 16,
      title: "database password ",
      $type: "login",
      folders: [
        {
          shared_folder: "Transferred: Account\\Test Item",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 17,
      title: "df test passkey",
      $type: "login",
      custom_fields: {
        "$passkey::1": {
          privateKey: {
            crv: "P-256",
            d: "INFd1nfJXzWQTVA_gO05sJWhr1E7mT38FiXpWHWn7do",
            ext: true,
            key_ops: ["sign"],
            kty: "EC",
            x: "zt8Ep3IGHmulk-sNUzf4DYigBMwCW1y4-r2F8btyP00",
            y: "6Mle-D6XWB0w00KPluhUJfogdiPCKfrnXWWVa3pB_ac",
          },
          relyingParty: "webauthn.io",
          username: "dflinn@bitwarden.com",
          userId: "SGFrem1zcEpmenhqVWdSTzdJbkFjekprbEQxNHdXOWhfNndzRVg3WnU0OA",
          credentialId: "emT9hUJ733PIQh2RapEu-23WYzUnNamXIxtD9fCkEbk",
          signCount: 0,
          createdDate: 1716424389832,
        },
      },
      login: "dflinn@bitwarden.com",
      login_url: "https://webauthn.io/",
    },
    {
      uid: 18,
      title: "Facebook26",
      $type: "login",
      custom_fields: {
        "$oneTimeCode::1":
          "otpauth://totp/Google%3Asbolina%40bitwarden.com?secret=6whhjvsb3taxmlf4e7fk4v7lsusuv2m5&issuer=Google",
      },
      login: "username@email.com",
      password: "T6wzV^>#dgHiV9P9S3dl",
      login_url: "https://facebook.com/login",
      folders: [
        {
          shared_folder: "Marketing",
          folder: "Social Media",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 19,
      title: "Generator test",
      $type: "login",
      password: "password",
    },
    {
      uid: 20,
      title: "Github",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: "2!kW",
      login_url: "https://github.com/",
    },
    {
      uid: 21,
      title: "GitHub",
      $type: "sshKeys",
      custom_fields: {
        "$keyPair::1": {
          privateKey:
            "-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAnT4wOihMExuFhv/fjS8ClkuuXzGcYdc31AjS2k82hBP7bmD0\nwXgGCySkW5UkpVXlJ7eHmz75PFh4cjSTK68RZlmNaeBox79zJ1XP2GstrlmUwyRA\nIjmDwYt6l+8lmGj8sXVFNVIJERfpcugHcUnoSbCwQ/mNuua1kXM3sM1WupcMhu/e\ntlp4NB/utTpZ7bDCoz+qRXaTJOFnhKg6JfyRBHaM6RKtyndc4DlN15P8fDAE+Oxl\ntOHYlJZ5HAyhqpRYDJNAVzXVjSG4q3E4LlwOgiy/x43fGu3Y9fPWp7iCbJRegmAQ\n1NU2nrP5we2PaBkUJRM3FniO2P9rAWxao51S7wIDAQABAoIBAHbtskxKbj+FcVjJ\n7qs6Axrp4tjdDQpzXSZiBhhYEUOUWXcCnhw2S1viOu2JwE3MyaVgipBA8QFTaMX4\nPdescdyXnv2VXaq2gsIdhTaK2eIknv95S4iXN7ALbo27sxOzVGxj5hSOF412KHtg\nQ0DMRYR2vtqqxSe3l1yLaHOw2wgERNa10HCx444YIYqA3e1+d2EDpV3Qm0PCxJ07\nnG+0paOFQVa/LuQ9uJRiFl/vltKYts0Lq7IctTvzvdlgPcbkZLeTOM1E2NJ4aA6I\nEI13C+wnyrlaCOqJsUd9vJIx1DDSgJQG4yPnFqhh1XBEXJzdA7R9L4Hzh9+oCPA2\nizppFgECgYEA5BETAijDVhIHN7qIsRgQ33L0uhpign2J2ttWBJf1pWgXNZ2jE6+D\ntL1TLjV2T/SXIcqSWq3vE9X24epsUePWzgvcJDuoFl56B2GN52MkMarKxSk/Lizz\nksoo7rC86mXFelQFHgkXvv0j9dSnDhOGv88yTKn1EDux4TeK94iw/FcCgYEAsIB3\nrj6UjLsoK1B0odGtP73Jqmrsb74ovEIxWoQwIIl5wj5giJG22sey1b+At5dh+E48\nVRQgWDOWM8zSmUihN+Ktmt2XIrfnWVSMDxI+ge1tQ6kwxBO6VkdQlj16UkUUYRcD\nkTtojDWub5aKsb9eGhIdN8YSuysvlJIwFAUAvykCgYBb84JdcX/oGNauIlfwRsqu\nvJNs4Sxsfh7xjVMuAPJ6YPBSnp7cVfxdB6Qc0lNEQ1IXvqupQc1NiwvB5BkOHzVA\n18lHFoJbmnXKugtTikZSfBDK0yl0/Yyq1zUPn1RbkPLAslVp2bKoPzmbaMR9yWOf\nu/MEs9VpWRgLvLAbwxHQewKBgBYUG+R6A48PIlk4uT48wlVE4mMk+OqJeQMDrLTL\n8FFBoS+BKgYrZBo9/MrsJ6fPkfvDnZxu5hTibxmPt5BhG3moK1tB+NPo+VGdV9/S\nwmryTka2dVkxto9wYE5K5nBAH+p9PH8AVXWkiWuAA110uMq+FVWSu2kaX9tP5h+6\n+HrxAoGAUDMYrWY25Fvv8l8xDo3O9PhS6SYatwpBkA+bR8hwIjtooauyEZY5lwep\nupX9pZMZPXHpDcYVUNQtmW5THwtPQovoMtKoE03I6iZ4b5lPr57oq2InfHnWOeh1\nthZu7sHrftiVSmkx/N1D6WWXdEnSROx/Vl8MqnHoPlQpChK+o4E=\n-----END RSA PRIVATE KEY-----\n",
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCdPjA6KEwTG4WG/9+NLwKWS65fMZxh1zfUCNLaTzaEE/tuYPTBeAYLJKRblSSlVeUnt4ebPvk8WHhyNJMrrxFmWY1p4GjHv3MnVc/Yay2uWZTDJEAiOYPBi3qX7yWYaPyxdUU1UgkRF+ly6AdxSehJsLBD+Y265rWRczewzVa6lwyG7962Wng0H+61OlntsMKjP6pFdpMk4WeEqDol/JEEdozpEq3Kd1zgOU3Xk/x8MAT47GW04diUlnkcDKGqlFgMk0BXNdWNIbircTguXA6CLL/Hjd8a7dj189anuIJslF6CYBDU1Taes/nB7Y9oGRQlEzcWeI7Y/2sBbFqjnVLv \n",
        },
      },
      folders: [
        {
          shared_folder: "Marketing",
          can_edit: false,
          can_share: false,
        },
        {
          shared_folder: "Shared Project Folder",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 22,
      title: "GitHub (2)",
      $type: "login",
      login: "garrisonconsultingcorp+12@gmail.com",
      password: 'bN:k"-26vXB558n![At%',
      login_url: "https://github.com",
      folders: [
        {
          shared_folder: "Marketing",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 23,
      title: "GitHub 0",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: "5n[$$4nxB,E}.S3%2UT,321",
      login_url: "https://github.com",
      folders: [
        {
          shared_folder: "Inheritance",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 24,
      title: "Google",
      $type: "login",
      login: "enh4ju3ii902w",
      password: " wnejiu0r9-",
      login_url: "https://google.com",
    },
    {
      uid: 25,
      title: "Google",
      $type: "login",
      login: "k@gmail.com",
      password: "2ioiqeou3rwe49iopfldwm,ekrfodgpv",
      login_url: "https://google.com",
      folders: [
        {
          shared_folder: "Transferred: garrisonconsultinguser@gmail.com\\Marketing",
          can_edit: false,
          can_share: true,
        },
      ],
    },
    {
      uid: 26,
      title: "Google",
      $type: "login",
    },
    {
      uid: 27,
      title: "Google account",
      $type: "login",
      login: "Alphabetsoup@gomail.com",
      password: ";lkajsd['fopi",
      login_url: "https://google.com",
    },
    {
      uid: 28,
      title: "Google account",
      $type: "login",
      login: "Alphabetsoup@gomail.com",
      password: ";lkajsd['fopi",
      login_url: "https://google.com",
    },
    {
      uid: 29,
      title: "Google account",
      $type: "login",
      login: "Alphabetsoup@gomail.com",
      password: ";lkajsd['fopi",
      login_url: "https://google.com",
    },
    {
      uid: 30,
      title: "Google account",
      $type: "login",
      login: "Alphabetsoup@gomail.com",
      password: ";lkajsd['fopi",
      login_url: "https://google.com",
    },
    {
      uid: 31,
      title: "H-E-B2",
      $type: "login",
      login: "test123345",
      login_url: "https://heb.com",
      folders: [
        {
          shared_folder: "Marketing",
          can_edit: false,
          can_share: false,
        },
        {
          shared_folder: "Dev build ",
          folder: "dfdfgh",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 32,
      title: "HealthEquity",
      $type: "Insurance Card",
      schema: ["$text:Company:1", "$phone:Phone Number:1", "$pinCode:Policy:1"],
      custom_fields: {
        "$text:Company:1": "Health",
        "$pinCode:Policy:1": "319139139",
      },
    },
    {
      uid: 33,
      title: "Item 1",
      $type: "login",
      folders: [
        {
          shared_folder: "Inheritance",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      uid: 34,
      title: "Item 1-2",
      notes: "1\n2\n3\n",
      $type: "login",
      login: "item12@gmail.com",
      password: "Bm]2;yMfBl47=l%DKpbf",
      login_url: "https://google.com",
      folders: [
        {
          folder: "IT Project\\Folder 1\\PersonalNested-1-2",
        },
      ],
    },
    {
      uid: 35,
      title: "Log in to Fidelity",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: "2:8ipgr^3Z*D6F/N=sl~",
      login_url: "https://digital.fidelity.com",
    },
    {
      uid: 36,
      title: "Login 1-1",
      $type: "login",
      login: "usernamea",
      password: "9mPZLFE5V,^jvQY!e9p$",
      login_url: "https://safasf.com",
      folders: [
        {
          folder: "IT Project\\Folder 1\\PersonalNested-1-1",
        },
      ],
    },
    {
      uid: 37,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 38,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 39,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 40,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 41,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 42,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 43,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 44,
      title: "My Item 1",
      notes: "Notes for item 1",
      $type: "login",
      login: "username1",
      password: "password1",
      login_url: "https://github.com/item/1",
    },
    {
      uid: 45,
      title: "name",
      $type: "login",
    },
    {
      uid: 46,
      title: "Nested 1",
      notes: "a\nb\nc\nx\nasf",
      $type: "login",
      login: "one@nested.com",
      password: "AUk%fp8w+LDS=yVCrhB0",
      login_url: "https://item.com",
      folders: [
        {
          folder: "IT Project\\Folder 1",
        },
      ],
    },
    {
      uid: 47,
      title: "Nested-2-item",
      notes: "item 1 2",
      $type: "login",
      login: "username_nested12",
      password: "PvmjjN(wrhd?5QK@Z0as",
      folders: [
        {
          folder: "IT Project\\Folder 2",
        },
      ],
    },
    {
      uid: 48,
      title: "new item",
      $type: "login",
    },
    {
      uid: 49,
      title: "Original Item to Share",
      $type: "login",
      login: "test",
      password: "abc123",
      login_url: "https://test.com",
      folders: [
        {
          folder: "IT Project",
        },
      ],
    },
    {
      uid: 50,
      title: "PersonalItem",
      $type: "login",
      login: "test",
      password: "9%}$kDQ#IU_R`UD$u@NY",
    },
    {
      uid: 51,
      title: "record can view",
      $type: "login",
      folders: [
        {
          shared_folder: "Inheritance",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 52,
      title: "Reddit",
      $type: "login",
      login: "reddit@bitwarden.com",
      password: "gSDDh)(E1VZ6Zya6o)JA",
      login_url: "https://reddit.com",
    },
    {
      uid: 53,
      title: "Sensitive Login Credential",
      $type: "login",
      login: "UpdatedSensitiveemail@email.com",
      password: "8`<h_'-VrJWPH3QiuCE`",
      folders: [
        {
          shared_folder: "Shared Project Folder",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 54,
      title: "Sign in | CVS Health",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: ")ybR(o)t?pa@}Z1Y<3u@",
      login_url: "https://www.cvs.com/account/login",
    },
    {
      uid: 55,
      title: "Sign up — Shopify",
      $type: "login",
      custom_fields: {
        "$passkey::1": {
          privateKey: {
            crv: "P-256",
            d: "3jBG5R6mu405_yscm2Fb3N-568tvkL6JvqfQIHTFRAU",
            ext: true,
            key_ops: ["sign"],
            kty: "EC",
            x: "yZzrnArgBzgqB8cRZgJ-OaKKA3T610TjxdMnCFt3P4g",
            y: "THfC7y4VCk91F4e2xMIPvTd3todQw36weJ1-GcBIE6s",
          },
          relyingParty: "accounts.shopify.com",
          username: "garrisonconsultingcorp+1@gmail.com",
          userId: "OWVkY2FlYTYtOWFiYi00MjY4LTlhZjUtZGQxMGQ2ZmRhNTcz",
          credentialId: "GxMyvyhhJk3UyYqRONXtYM-Zjh2nxY45stdltAvpgE4",
          signCount: 0,
          createdDate: 1696312289058,
        },
      },
      login: "garrisonconsultingcorp+1@gmail.com",
      password: "1OudC7+fChM9SC{77(vm",
      login_url: "https://accounts.shopify.com/signup",
    },
    {
      uid: 56,
      title: "simple login form | Test the Web",
      $type: "login",
      login: "garrisonconsultingcorp@gmail.com",
      password: "fkdslkfmdklsmflskdmfc",
      login_url: "https://webtests.dev/forms/login/simple/",
    },
    {
      uid: 57,
      title: "simple login form | Test the Web",
      $type: "login",
      login: "test@test1",
      password: "asdfasfas",
      login_url: "https://webtests.dev/",
    },
    {
      uid: 58,
      title: "strength",
      $type: "login",
      password: "password",
      folders: [
        {
          shared_folder: "Inheritance",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 59,
      title: "Taco Bell",
      $type: "login",
      custom_fields: {
        "$oneTimeCode::1":
          "otpauth://totp?secret=DFHDFR6T76U6&issuer=&algorithm=SHA1&digits=6&period=30",
      },
      password: "test12345",
      login_url: "https://tacobell.com",
      folders: [
        {
          shared_folder: "Marketing",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 60,
      title: "test",
      $type: "login",
      password: "(K>9Sc7poy!rZ!!4jrzq",
    },
    {
      uid: 61,
      title: "test",
      $type: "login",
      login: "username",
      password: "password12345",
      folders: [
        {
          folder: "Personal",
        },
      ],
    },
    {
      uid: 62,
      title: "test",
      $type: "login",
      login: "test",
      password: "12345678",
    },
    {
      uid: 63,
      title: "Test",
      $type: "login",
      login: "github admin",
      password: "password123",
      folders: [
        {
          folder: "Transferred: Account",
        },
      ],
    },
    {
      uid: 64,
      title: "Test",
      $type: "login",
      folders: [
        {
          folder: "Transferred: garrisonconsultinguser@gmail.com",
        },
      ],
    },
    {
      uid: 65,
      title: "Test address",
      $type: "address",
      custom_fields: {
        "$address::1": {
          country: "US",
          street1: "12234 Oak st",
          city: "Portland",
          state: "Maine",
          zip: "97245",
        },
      },
    },
    {
      uid: 66,
      title: "Test Autofill",
      $type: "login",
      login: "username",
      password: "password",
      login_url: "https://fill.dev/form/login-simple",
    },
    {
      uid: 67,
      title: "Test for 1-many",
      $type: "login",
      login: "cmuentes",
      password: "Password1!23",
      folders: [
        {
          shared_folder: "Inheritance",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 68,
      title: "test inheritance",
      $type: "login",
      login: "test123",
      password: "lunch",
      folders: [
        {
          shared_folder: "Inheritance",
          folder: "name change-folder",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 69,
      title: "test Login",
      notes: "notes",
      $type: "login",
      login: "asfas@asfas.com",
      password: "afsdf234ffdsgfsdg",
      folders: [
        {
          folder: "Personal",
        },
      ],
    },
    {
      uid: 70,
      title: "Test person",
      $type: "contact",
      custom_fields: {
        "$name::1": {
          first: "Ted",
          last: "Lassso",
        },
        "$text:company:1": "Greyhounds",
        "$email::1": "ted@greyhounds.io",
        "$phone::1": {
          number: "1234567899",
        },
      },
      references: {
        "$addressRef::1": [65],
      },
    },
    {
      uid: 71,
      title: "test2",
      $type: "login",
      login: "test2",
      password: "12345678",
    },
    {
      uid: 72,
      title: "TikTok",
      $type: "login",
      login: "test@test.com",
      password: "test",
      login_url: "https://tiktok.com/",
    },
    {
      uid: 73,
      title: "TOTP Test Item",
      $type: "login",
      custom_fields: {
        "$oneTimeCode::1":
          "otpauth://totp/Acme%20corp:me@example.com?secret=PCP27OAIJORGCMLM&issuer=Acme%20corp&algorithm=SHA1&digits=6&period=30",
      },
      password: "QOR$e0<oYY@z?4=A?+BR",
    },
    {
      uid: 74,
      title: "Twitter",
      $type: "login",
      login: "fake@username.com",
      password: "WC?,e(>FMl7<r?i=[9#T",
      login_url: "https://twitter.com",
    },
    {
      uid: 75,
      title: "VISA",
      $type: "bankCard",
      custom_fields: {
        "$paymentCard::1": {
          cardNumber: "5555555555555555",
          cardExpirationDate: "02/2028",
          cardSecurityCode: "123",
        },
        "$text:cardholderName:1": "Ted Lasso",
        "$pinCode::1": "1235",
      },
      folders: [
        {
          shared_folder: "Marketing",
          folder: "Social Media\\Cards",
          can_edit: false,
          can_share: false,
        },
      ],
    },
    {
      uid: 76,
      title: "webauthn.io",
      $type: "login",
      custom_fields: {
        "$passkey::1": {
          privateKey: {
            crv: "P-256",
            d: "nfIHd1a6DrNDNwcCTITm2fD0yiuNL87GKgWekITqxlU",
            ext: true,
            key_ops: ["sign"],
            kty: "EC",
            x: "OmaNabACJWhe-f00hI_w58EEbMVj5NZDJOxTt3SK-uc",
            y: "X9Qn6HIHS64vESlhJFrrC9QVHritQHpkORQqOKncwPU",
          },
          relyingParty: "webauthn.io",
          username: "swws",
          userId: "YzNkM2N3",
          credentialId: "U77TzqFNXmK4yB8Ceja7y7qL6SItqjCscS3sf9QAKHQ",
          signCount: 0,
          createdDate: 1701896375235,
        },
      },
      login: "swws",
      login_url: "https://webauthn.io/",
    },
    {
      uid: 77,
      title: "webauthn.io",
      $type: "login",
      custom_fields: {
        "$passkey::1": {
          privateKey: {
            crv: "P-256",
            d: "E-0xfnEGKhGxrm2PU9fV0byX2xvBOvzswAmmjAUw_bM",
            ext: true,
            key_ops: ["sign"],
            kty: "EC",
            x: "8JfyBd5D4y7J94saJwSOcT_7rEL_obF3W56qL6Yv-yc",
            y: "muNxxBgLiK7C-6C4pVVZBDxffN91hEqDBqHLP-lvqJg",
          },
          relyingParty: "webauthn.io",
          username: "ssss",
          userId: "YzNOemN3",
          credentialId: "yqC9HkJ2ZSk4KM6q1wp-YLxry8tXA1rL1B9XbdhvR_w",
          signCount: 0,
          createdDate: 1701896892031,
        },
      },
      login: "ssss",
      login_url: "https://webauthn.io/",
    },
    {
      uid: 78,
      title: "Zoom",
      $type: "login",
      login: "medelblut@bitwarden.com",
      password: "CCS0bLf]}xJMR32qJ=sY",
      login_url: "https://zoom.us",
    },
  ],
};

export const EnterpriseTestData = {
  shared_folders: [
    {
      uid: "IekxlXXiXfPuBzN4LOSH3g",
      path: "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+10-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
    {
      uid: "1Hgsx3lYavUL53TIADchiA",
      path: "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
      manage_users: false,
      manage_records: true,
      can_edit: true,
      can_share: false,
      permissions: [
        {
          name: "lastpass.ruby+10-december-2025@gmail.com",
          manage_users: true,
          manage_records: true,
        },
      ],
    },
  ],
  records: [
    {
      title: "Admin Dashboard Connection",
      notes: "Secure web browser connection to admin panel. Requires VPN access.",
      $type: "pamRemoteBrowser",
      custom_fields: {
        "$rbiUrl::1": "https://admin.company.internal/dashboard",
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Database Tunnel to Production MySQL",
      $type: "pamDatabase",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "mysql-prod.company.internal",
          port: "3306",
        },
        "$checkbox:useSSL:1": true,
        "$pamSettings::1": {
          connection: {
            port: "3307",
          },
          portForward: {
            port: "8306",
          },
        },
        "$text:databaseId:1": "db-prod-mysql-01",
        "$databaseType::1": "mysql",
        "$text:providerGroup:1": "Production-Databases",
        "$text:providerRegion:1": "us-east-1",
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Dell PowerEdge R740 Server",
      $type: "Hardware Asset",
      schema: ["$text:Serial Number:1", "$date:Purchase Date:1", "$date:Warranty Expiration:1"],
      custom_fields: {
        "$text:Serial Number:1": "SN-R740-2024-001",
        "$date:Purchase Date:1": 1710457200000,
        "$date:Warranty Expiration:1": 1805065200000,
      },
    },
    {
      title: "GitHub Enterprise Plan",
      $type: "SaaS Subscription",
      schema: ["$text:Service Name:1", "$date:Renewal Date:1", "$text:Plan Type:1"],
      custom_fields: {
        "$text:Service Name:1": "GitHub",
        "$date:Renewal Date:1": 1782770400000,
        "$text:Plan Type:1": "Enterprise",
      },
    },
    {
      title: "Production Gateway Server - Bing Remote Browser",
      $type: "pamRemoteBrowser",
      custom_fields: {
        "$rbiUrl::1": "https://bing.com",
        "$pamRemoteBrowserSettings::1": {
          connection: {
            protocol: "http",
            recordingIncludeKeys: true,
            allowUrlManipulation: true,
          },
        },
        "$trafficEncryptionSeed::1": "ZujawowmK4rAXEjdm08VCFHUVJsPiDirvvCute4Gb1g=",
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - MySQL Admin User",
      $type: "pamUser",
      login: "root",
      password: "r7gJ6Zl5BXktS4IPGh4D",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - MySQL Database",
      $type: "pamDatabase",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "db-mysql-1",
          port: "3306",
        },
        "$checkbox:useSSL:1": true,
        "$trafficEncryptionSeed::1": "PzOWZhg09VwxTwYeXZJmdHaNFtAruukP8gzXvkkPrqo=",
        "$pamSettings::1": {
          connection: {
            protocol: "mysql",
            port: "3306",
            recordingIncludeKeys: true,
          },
          portForward: {
            port: "3306",
            reusePort: true,
          },
        },
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - MySQL Rotation User",
      $type: "pamUser",
      login: "sqluser",
      password: "wi7s3f3oiypS3QNc5zIe",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - RDP Admin",
      $type: "pamUser",
      login: "root",
      password: "3DI02SUdpQj5aHZ9Fsba",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - RDP Machine",
      $type: "pamMachine",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "server-rdp",
          port: "22",
        },
        "$trafficEncryptionSeed::1": "yJsgoM7cuMAqkf5u8VTTVGNCKOirobWXOjthBRlb2bw=",
        "$pamSettings::1": {
          connection: {
            protocol: "rdp",
            port: "3389",
            recordingIncludeKeys: true,
            security: "any",
            ignoreCert: true,
            resizeMethod: "display-update",
            enableFullWindowDrag: false,
            enableWallpaper: false,
          },
          portForward: {
            port: "3389",
            reusePort: true,
          },
        },
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - RDP User",
      $type: "pamUser",
      login: "rdpuser",
      password: "vHnhlJGOYfYRh55X5O1v",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - SSH Admin with Password",
      $type: "pamUser",
      login: "linuxuser",
      password: "y85AT00NA2nlR2qijOpF",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - SSH Admin with Private Key",
      $type: "pamUser",
      login: "linuxuser",
      custom_fields: {
        "$secret:privatePEMKey:1":
          "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAQEAoPQcja8tCSj2kCfCjszKP5Dvzj8xcqhmGug/f70SVJzrZagB0Bk1\nFtZ6v+RvGoOYLIuYoWBBBD0rIDPSfYP5Bu/aSsYf5LAHaRWZuli+ZVVkHCnahGs9+r5GJS\nSwFrlDHgTNrDOyb2ctnV304gJ1+OoG3SRVfGxztdAF34OUKkNCbf1z6qfL0VPBo7blm7aq\nqvn9xi99ukOjaxIWqMfQ0xVucoR6rHO/bpVLYtMuxaawtk9eSwlQf7m/A1bp4fL1cyPlhg\nO9b5NVaotZgQ7KW7r5Ofc90kpi9z4Y1gzQQGrh2TQ0kQe4w/yFn4NmPNzL1JSwJU/vqcJ9\n6guNss8rswAAA8grUkDYK1JA2AAAAAdzc2gtcnNhAAABAQCg9ByNry0JKPaQJ8KOzMo/kO\n/OPzFyqGYa6D9/vRJUnOtlqAHQGTUW1nq/5G8ag5gsi5ihYEEEPSsgM9J9g/kG79pKxh/k\nsAdpFZm6WL5lVWQcKdqEaz36vkYlJLAWuUMeBM2sM7JvZy2dXfTiAnX46gbdJFV8bHO10A\nXfg5QqQ0Jt/XPqp8vRU8GjtuWbtqqq+f3GL326Q6NrEhaox9DTFW5yhHqsc79ulUti0y7F\nprC2T15LCVB/ub8DVunh8vVzI+WGA71vk1Vqi1mBDspbuvk59z3SSmL3PhjWDNBAauHZND\nSRB7jD/IWfg2Y83MvUlLAlT++pwn3qC42yzyuzAAAAAwEAAQAAAQBAiB86n1WLKqVQvuA+\nqNUeD1pWcve8ZNArUZrD+GZ1DkVDCM1RRgoHEg89CLWTB9fnZEDZ0uG+dVfpHV3zfQpHQb\ntf53e6FOmjtElicVpE/quYrx8xoF3FPqyZD9CaC8VhL8PWmxObnt6nDZi1VQ8/sXT3DS5J\nKKJr7u+r4fFxz8r4xVkKdsJR9I9gjzUd/ntJdzdRPytaev5URg0G2Zc/iHMzJEV2+78RRM\nnWpCWAOJRJwfHt5dLDZ9qrF8aXVxLm+6c+dIWwJPUipQibyf4fTjAh6v+S29NeAfGFX5SB\n5DuKi4NsdgL0aaOQlE5G2+99BxZZwLsJiwx0jzmA/PKBAAAAgFNdYb3sWPxuPra8WkhnHe\ndhS3cu3EesiAlHxrJwqjyQYshIM4A7UIT6JrWgg35Y9C/9JGZKijJ7X6N7t0l+W5nO7FNy\nDE94uG9IX4twcUyHqU+lRrLfiQC9RrOrjqxVOlHqqKLndWtmwqK4HqncgUz8S/fk3GYsuv\nsYU96D+/AuAAAAgQDLnBuj8YoNmB+wv3Q/wvXrWG37q7n/GKQDya4AXMOWCcITl3FH3cm3\n9HlzJwonpGLq+NSqSnI6PH9flbqbFV7aMvmxrvLRQasJAn5+p8qkLQVxeAFqCkliUBfOPn\nXSB+zVzLJEJYcQ7d92ZPk7+RyRSw82BenELBwIiy9FSrKD0QAAAIEAyl42mHD+IUfUEU81\n2VrDinB9vLsIrpamW44ssl3g8MUKr70Il6vZ8YbGlcEzzopjVXsrArmgZQLImK/MYatv4W\n/NKD7FH2tqrsXe/k3hfsAvPfIZCt45I1G2aRL2BlnsFkVqEdtzuROuicVHB4K+zYawvaat\nFtphdeGIeany7EMAAAAPbGludXh1c2VyQGxvY2FsAQIDBA==\n-----END OPENSSH PRIVATE KEY-----",
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - SSH Machine with Password Access",
      $type: "pamMachine",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "server-ssh-with-pwd-1",
          port: "2222",
        },
        "$trafficEncryptionSeed::1": "mzwDi9MzsON9wbqygMvHoj0iFnPueFKpPjOfQ+lmgK4=",
        "$pamSettings::1": {
          connection: {
            protocol: "ssh",
            port: "2222",
            recordingIncludeKeys: true,
          },
          portForward: {
            port: "2222",
            reusePort: true,
          },
        },
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - SSH Machine with Private Key Access",
      $type: "pamMachine",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "server-ssh-with-key-1",
          port: "2222",
        },
        "$trafficEncryptionSeed::1": "lKqwNJhcekaLF9/6hRyp9WoZBYAkH7PWI3i+HXg5Klc=",
        "$pamSettings::1": {
          connection: {
            protocol: "ssh",
            port: "2222",
            recordingIncludeKeys: true,
          },
          portForward: {
            port: "2222",
            reusePort: true,
          },
        },
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - VNC Admin",
      $type: "pamUser",
      login: "vncuser",
      password: "xWLu8Jix",
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Users",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Gateway Server - VNC Machine",
      $type: "pamMachine",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "server-vnc",
          port: "5901",
        },
        "$trafficEncryptionSeed::1": "dla+zeP1vYbOF+p5e9jltfkoWRb8tq1dmi4l+xfpUPI=",
        "$pamSettings::1": {
          connection: {
            protocol: "vnc",
            port: "5901",
            recordingIncludeKeys: true,
          },
          portForward: {
            port: "5901",
            reusePort: true,
          },
        },
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Production Server Auto Rotation",
      notes:
        "This is the main production server for auto-rotation. Critical system - handle with care. Rotation schedule: Daily at 3 AM UTC.",
      $type: "pamMachine",
      custom_fields: {
        "$pamHostname::1": {
          hostName: "prod-server-01.company.internal",
          port: "22",
        },
        "$pamSettings::1": {
          connection: {
            port: "2200",
          },
          portForward: {
            port: "8022",
          },
        },
        "$text:operatingSystem:1": "Ubuntu 22.04 LTS",
        "$text:instanceName:1": "prod-app-server-01",
        "$text:instanceId:1": "i-0a1b2c3d4e5f6g7h8",
        "$text:providerGroup:1": "Production-Servers",
        "$text:providerRegion:1": "eu-central-1",
        "$text:Application Version:1": "v2.5.3",
      },
      folders: [
        {
          shared_folder:
            "Production Gateway Server Folder\\Production Gateway Server Folder - Resources",
          can_edit: true,
          can_share: false,
        },
      ],
    },
    {
      title: "Windows Server 2022 License",
      $type: "Server License",
      schema: [
        "$text:Number of Seats:1",
        "$date:Expiration Date:1",
        "$text:Vendor Name:1",
        "$password:License Key:1",
        "$date:Purchase Date:1",
        "$text:Support Plan Level:1",
      ],
      custom_fields: {
        "$text:Number of Seats:1": "50",
        "$date:Expiration Date:1": 1767135600000,
        "$text:Vendor Name:1": "Microsoft",
        "$date:Purchase Date:1": 1673737200000,
        "$text:Support Plan Level:1": "Premier Support",
      },
      password: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    },
  ],
};
