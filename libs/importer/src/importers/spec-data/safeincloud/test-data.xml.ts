/* eslint-disable */
export const data = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<database>    <!-- LABELS -->
    <label name="Business" id="1"></label>
    <label name="Samples" id="3"></label>
    <label name="Web Accounts" id="4" type="web_accounts"></label>    <!-- TEMPLATES -->
    <card title="Web Account" id="102" symbol="web_site" color="gray" template="true" autofill="on">
        <field name="Login" type="login" autofill="username"></field>
        <field name="Password" type="password" autofill="current-password"></field>
        <field name="Website" type="website" autofill="url"></field>
        <field name="One-time password" type="one_time_password" autofill="one-time-code"></field>
    </card>
    <card title="Note (Sample)" id="206" symbol="note" color="yellow" type="note" autofill="off">
        <notes>This is a sample note.</notes>
        <label_id>3</label_id>
    </card>
    <ghost id="2" time_stamp="1615910263225"></ghost>
    <card title="Visa Card (Sample)" id="205" symbol="visa" color="0xff3f5ca8" autofill="on" time_stamp="1615910280931">
        <field name="Number" type="number" autofill="cc-number">5555123456789000</field>
        <field name="Owner" type="text" autofill="cc-name">John Smith</field>
        <field name="Expires" type="expiry" autofill="cc-exp">01/23</field>
        <field name="CVV" type="pin" autofill="cc-csc">555</field>
        <field name="PIN" type="pin" autofill="off">1111</field>
        <field name="Blocking" type="phone" autofill="off">555-0153</field>
        <label_id>1</label_id>
    </card>
    <card title="Facebook (Sample)" id="301" symbol="f" color="0xff3f5ca8" autofill="on" deleted="true" time_stamp="1615910298700">
        <field name="Login" type="login" autofill="username">john555@gmail.com</field>
        <field name="Password" type="password" autofill="current-password">early91*Fail*</field>
        <field name="Website" type="website" autofill="url">https://www.facebook.com</field>
        <label_id>3</label_id>
    </card>
    <card title="Google (Sample)" id="300" symbol="g" color="blue" autofill="on" prev_stamp="1615910345167" time_stamp="1615910386722">
        <field name="Email" type="login" autofill="username">john555@gmail.com</field>
        <field name="Password" type="password" score="4" hash="5c76cb4d2fd87820be94530315581e14" autofill="current-password">plain79{Area{</field>
        <field name="Website" type="website" autofill="url">https://www.google.com</field>
        <label_id>3</label_id>
        <field type="one_time_password" name="One-time password" history="{&quot;1615910350891&quot;:&quot;&quot;}" autofill="one-time-code">thisisanotp</field>
        <field type="secret" name="2FA-Reset" history="{&quot;1615910350891&quot;:&quot;&quot;}" autofill="off">thisshouldbehidden</field>
    </card>
    <card title="Passport (Sample)" id="203" symbol="passport" color="purple" autofill="off" time_stamp="1615910424608">
        <field name="Number" type="number" autofill="off">555111111</field>
        <field name="Name" type="text" autofill="off">John Smith</field>
        <field name="Birthday" type="date" autofill="off">05/05/1980</field>
        <field name="Issued" type="date" autofill="off">01/01/2018</field>
        <field name="Expires" type="expiry" autofill="off" score="1830380399000" hash="52f13d61109f06e642f86caf5e140474">01/01/2028</field>
        <label_id>3</label_id>
        <notes>This is a note attached to a card</notes>
    </card>
    <card title="Twitter (Sample)" id="302" symbol="t" color="blue" autofill="off" time_stamp="1615910462627">
        <field name="Login" type="login" autofill="username">john555@gmail.com</field>
        <field name="Website" type="website" autofill="url">https://twitter.com</field>
        <label_id>3</label_id>
        <field type="password" name="Secret login data" autofill="username" history="{&quot;1615910438286&quot;:&quot;&quot;}" score="0" hash="f9f910baf9c2cfb4f640e2d231f4a39b">shouldbepassword</field>
    </card>
    <card title="Laptop (Sample)" id="303" symbol="laptop" color="gray" autofill="off" star="false" prev_stamp="1615910472161" time_stamp="1615910473734">
        <field name="Login" type="login" autofill="username">john555</field>
        <field name="Password" type="password" autofill="current-password">Save63\apple\</field>
        <label_id>3</label_id>
    </card>
</database>
`;
