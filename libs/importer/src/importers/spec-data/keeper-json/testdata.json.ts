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
          folder: "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes",
        },
        {
          folder:
            "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes\\Name\\\\with\\\\backslashes",
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
          folder: "Development\\Web",
        },
        {
          folder:
            "Development\\Name/with\\\\both/slashes\\Name/with/forward/slashes\\Name\\\\with\\\\backslashes",
        },
      ],
    },
    {
      title: "Invalid SSH key",
      uid: "mP3O9xfpvyOHdI4fzyZuAA",
      login: "deploy_user",
      password: "blah-blah-blah",
      notes: "Broken ssh key",
      $type: "sshKeys",
      last_modified: 1762884879,
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
      title: "Production Server SSH Key",
      uid: "E1124I_NzDheHSckN3cEQA",
      login: "deploy_user",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      last_modified: 1762847761,
      custom_fields: {
        $keyPair: {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDNKtrfeBybhjHLGE9DD5ZlNol/g0Z2RSyKZa4DDFt2ZjuMYw6nx0OZggrRX6PbCYblkAtbSC2erLvNsZFgkLRyuTrmBydYpe1i9Eoig5Sk1okyOrenDfoWfuVlWJNWVj63wUm8+adobX+hOd8vzuQt818d9sEEwMA9SONevmJdQ1+YsE0M3Na+MqGyoqZaP6Gtoh+yOIiIuk2EyRS6CI7gbv6HkapU/+jh4anTaXsVA/xN0AkjuVk5dE1Znw//ThgfVbUPXsApFzoTsAs7eq4z2K21hHv6SVrGiqoTIgHTEIpxLi/Yaitkl5uPQRaAr/llPevFNkt3xeNkAAg//s5DkaQkT5QRwbN6ZiQf7eWwjRU3SIXr5uvYc7gJx7cJfpyHyZQtTyCq8OFDAIXMrTTaKNGSa/Z/kgeJUydgoP/TRLaRjZaTWB6VdPyIZyG1u/eQdbnTHVl0K51Dy0VXSVcoj1HWZPEMZHwymzYHspF7NO5pJ2/4L3B8H8QtRMT58ooUNlPAHuKHnXInNMYm8XBX6eE1KNoiaQilx9j7A95mkI6Njh0Fi+sXt9qZSLbjQ4k7oBNh/yqqMkJEZH/TbppNTf9KGjxBYgfeiHjnFA9GztlQ2XvspklIPXF8VdcxtwXSQ2tBe8TyWMbwlKNYEURoNVpB7H120MssS9JCrEdZ2Q== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\n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\n-----END OPENSSH PRIVATE KEY-----\n",
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
      last_modified: 1762877896,
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
      title: "Other bank",
      uid: "bWG_hWTz--kLtseN6CKiSg",
      $type: "bankAccount",
      last_modified: 1762881740,
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
      title: "Production Server SSH Key with a passphrase",
      uid: "H9qgL9gc1jGEK4hMqpIHWw",
      login: "deploy_user",
      password: "blah-blah-blah",
      notes: "SSH key for production server deployment - RSA 2048 bit",
      $type: "sshKeys",
      last_modified: 1762848661,
      custom_fields: {
        $keyPair: {
          publicKey:
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDGLWOv9FqwmTvKgHse41BtJmvutu6RG9WI1aSWjTJ1DSaZqYnGSeShHN4tg4sBXdiCq2sFASQ+rkbzhA/aQCqhsvQKIHMOcHIT2L2MKe5SfDfjb26krV7rRCjhaUyAiEX1mLc3UdfonL88zWGKUCiH8W7Ael/726VQJbW8eURJb2yLQNO8UaqobzXbQVoD015G9oxdrV3NbzCI87uwY//2ak9TOfgYjWzvTTjo3yZZhqaMUdqrtSUYVhM9tA+c8/BlWJis5lKy1R+ZsbTpPcESwuA4IVI5sqPaeVbQa/iUwiyv3T45TLt+pNp0gdGWbtm7rN88Ni9id7yq0+wEkGKSCvbCdUvHR4eQPhn0F/jUupzYvwIJ5o2k7XVg1KwsCJiTK+5ZaChjdzlXCBgmzQwWPcXic/EVTjaVoGhXJUdZnNwFTdgQEGf6tkngSFIBnLUyR9fV1zmwXUfLpT/yrqVJtiUDaupoa/3TvJSVH1IVut05p7WYB/oHL+TxIrp8PF6KdiB6VVmkkknf4mV+QdmeVYMXPX66yn9ctt8NCMkTffcN0D8SD2rRwQLRyyA3HrqtUkyQnsAhJ81r6ur3S5sgSwACCpix+F64bBLeatmke7hV7qvdXIKKRB/NDNaNN9i6leyAtjYLyE5ydWdOHI/Dywuj87JXl6TKRN9TOKb3pw== generated@local\n",
          privateKey:
            "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABBmV7At+9\nzD5OCow3owg2UZAAAAGAAAAAEAAAIXAAAAB3NzaC1yc2EAAAADAQABAAACAQDGLWOv9Fqw\nmTvKgHse41BtJmvutu6RG9WI1aSWjTJ1DSaZqYnGSeShHN4tg4sBXdiCq2sFASQ+rkbzhA\n/aQCqhsvQKIHMOcHIT2L2MKe5SfDfjb26krV7rRCjhaUyAiEX1mLc3UdfonL88zWGKUCiH\n8W7Ael/726VQJbW8eURJb2yLQNO8UaqobzXbQVoD015G9oxdrV3NbzCI87uwY//2ak9TOf\ngYjWzvTTjo3yZZhqaMUdqrtSUYVhM9tA+c8/BlWJis5lKy1R+ZsbTpPcESwuA4IVI5sqPa\neVbQa/iUwiyv3T45TLt+pNp0gdGWbtm7rN88Ni9id7yq0+wEkGKSCvbCdUvHR4eQPhn0F/\njUupzYvwIJ5o2k7XVg1KwsCJiTK+5ZaChjdzlXCBgmzQwWPcXic/EVTjaVoGhXJUdZnNwF\nTdgQEGf6tkngSFIBnLUyR9fV1zmwXUfLpT/yrqVJtiUDaupoa/3TvJSVH1IVut05p7WYB/\noHL+TxIrp8PF6KdiB6VVmkkknf4mV+QdmeVYMXPX66yn9ctt8NCMkTffcN0D8SD2rRwQLR\nyyA3HrqtUkyQnsAhJ81r6ur3S5sgSwACCpix+F64bBLeatmke7hV7qvdXIKKRB/NDNaNN9\ni6leyAtjYLyE5ydWdOHI/Dywuj87JXl6TKRN9TOKb3pwAAB1CCfZEJWIiNc7Oh2Pu9SenL\nWRFG1Q24JT5SkP0G3C++Zq/R4rYZcE4T+Iv/g720OkAWi7pLRFgPtLiFgg46a0dLK99rDv\nIGGS3/aThRKKgNrY0OlQj0sD2z3TUs+srMyStSj2RLvvVKamUKqi/FAfDBlnIS78suxLiZ\nn6gn6OwkMxgja4ygwAdRzbMiO2zJ23ZQSvpMM/HJgV5P3kaPXAoJvJgDiuhcGmCQINfBFP\neYauZzWz/D6nDWfZuIIEt9Uv+lYHj8BAD5hivFs+mhmIOLB87tfJW1vFPHPI9KXNl9v1ZJ\n2x+Vkcq+mVmRJxmK9wwVI+iyhNqSzTZWsKFmrDbmKVpSAmq0UjMlSnkS+31EwBLa+moOKs\nlSeUUtH+zCwwfCaEJ+9lsP9NnepeSN+VrNtSMy0YdZ8RhD6MtbrYLoT5P/uZjU5lFS+YHL\nx6juucTQejnnAzKZktPURJwsC9DeE6ZRSkJgF/u2WDS1GyuxUAyx5aCbSq7K8NcTT20GvG\nPY+q1wJVNCQXaCzUqxXGAfczzF4kiaG7m8QWz5Vf4tYT+FqjByP+d2oVzujetLuJ7uY34i\nUitCA23arNta1UdfeJdgj0DIeMRronihStPGgsCv1L+s2uONdhuKjGJmDZuaO43CAktLTr\nYOu/CTYmV3lLRl4ZnFMXaUwFzgjN3YgmXUoMBdLyCDVH2tAIx5OZXiMPejpo0pyE2Ff1ug\nTbmvyIycTOF7oDSI3YNyM+wS3SmM7wBotNH9CkYRv4TlOYd6vjEgos01MTfyo9xJ4AxCbP\nUg+E3xwrvDopGykEI8RPHQEvKU7NGNWIqFcztDPzf15AcCFlGO0SNJ2dWLLq7dpFvztyEj\nxL11ZEyMftJJGTpCg8h/QwyUoddaQ67f+m9dOQgROMoBlXXlkn33uyNGr9TBuJ42iVHxiZ\nmZXU80jyWWWPiyrBsrfS8Skz+GtCc3a4EQN10xNvhTDYcZ5SGh4Oe/O9CMqgPpYfguxegC\nI4nYgYsR8SBl3n2esvzJMyK4OI3lad1wnA3vP3NZ+JKt1rVhi64Ddb/yXNQPEwU7evmOU+\naNUp5dQ+gy1gijVT1vd/EfLo2FBP3LaIwc7ipsZEWCPMdMoOCyq5qUgfHmIJhfLeq1t2de\n56VJaI2J39riuSV7XC+Z7MBrmOmsqDoGMNsSDBKQ6zgttE2/m6srOsS8CJCdEZ/Gnd+jp7\nqTL8jmWQJTSjImoD4AubGfr7w7jl0vGvFImYlOyITY68CXCvNReu+b8a0Tg6E0U2MAlM0s\nIJTXYH4NPa/ge6ZfcKOgpo7+umD/JBXnIZxoCOGIs9BhD5Zd0+Zuke1mkIQc9kjqt+yuRa\nYq6lioauQRqZECEMZP5tKBZ5zCGUbmWCo73U0PJ1rURbZlzM/s5WnNZ1d23EACUd9zDFNK\n8MFzoNT7Jvw2xpUSudl/N7ufczQopk7/a2ynoeWjbDU+g49ZBg/J8ZRa1f7cXmAthEaxBR\njc7cR8TFDcEKBtq8lFBWVarDOSKqMYmUp9/12Gei16d1yPKhpU6o0D93lU+Sq1pFN31PoZ\nEwQ9cCzoonSmoiY7s9tx4otdIVPvqNAscbbG0AFSi7754Baw42d8FozZg8Igw0U/NaiP5K\nXSrdcovtvHsD0cYYhDi/tyt2vWjLGd4MyKAMiGa0e6to9cy5TzyF9+h+mf1r0TYULKU+x/\nfiTVCMZ9aiE1eK/DuFHFdl+riCUbyEt5nvbKQ2gWycrhQDdM/meYVhsrwnrAa3O0Q2Calg\nA94qbEeQO20LH62ji+0sOL56MzjTA3KIB/N5f+MFDAcVE5Z7WbD1k1PB4YaONvLq/7Hh+l\nDMOasQlIheebEDFVTX3z34KqcuFbMjcZ+EfcY1e/j1lpjDsAUroD8x3oGddIXwJf08ZBvk\nFAj5RgKjWY0C8nK37OvcDbqIyTyH3/tNHTIfGUg15nSth/Eb/fWMdEo0Bvjk2w0DqfFs8k\nJVRFT1A6UXOLjebCw16YQ+ZxG1m2h6VEZQq8zIz67U4TS8wQ2lXqGBCX6gU23diyDjLERH\nOaqncx+yjpNUccuAY2AT88dhVr4x/a/zQvU3a713JdE2B0hojvSmV+MfM5LHNDnwRiC7TS\ne+EqBMK7Z2WQ/jLtakcfVuJOJQBtALFA0bY8g0sBDtXvTpOGY+skxPs0iBNODNX3cffu3o\nyUVgsLC/WwxjI0KlCW7hBxWPE5jlrvcAhFME6YBCtHFHAiRECRLHBufZPBt9U3s45vm2LE\n6siyhf4/YLuv203CiGR7/ZVMa9exSTd3ngXCUDKTR8QXI60TRToRMF8R/uFh+bQAfrCMKW\nYQqclHhJHiSrOOZP20CRHJ+YB9nVxdQAHPCEMQN8/RitgucC3dCeidBVSmqZHS00HsAgnE\nln1I9SW2wK/EiKpOG4smAI+vty1Vt9no8JmGPpjw9zqxOX8P4wD+OldnLm32uFDGkpUQ3q\n203O/Ve2/iEoB1CDJQVO7iWcE=\n-----END OPENSSH PRIVATE KEY-----\n",
        },
        $host: {
          hostName: "prod-server.company.com",
          port: "22",
        },
      },
    },
    {
      title: "Amazon Account",
      uid: "fZuZy2b5jZa4xcmbZgs7ng",
      login: "john.martinez@email.com",
      password: "Sp@rkl3Sun!2024",
      login_url: "https://www.amazon.com",
      notes: "Primary Amazon account for online shopping and Prime membership",
      $type: "login",
      last_modified: 1762886098,
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
      },
      folders: [
        {
          folder: "Education",
        },
      ],
    },
  ],
};
