// Standard Restiq Platform Services Agreement (issue #238): the starting text
// ops loads into the publish form. Square-bracketed [ ] values are for ops to
// fill before publishing; {{customer.*}} fields are filled per tenant by the
// backend when the owner signs. Markup: "# " headings, blank-line paragraphs
// (see src/components/agreement-document.tsx).
// ponytail: a drafting template, not legal advice - have it reviewed by a
// lawyer in each country before the first version is published.

export const STANDARD_AGREEMENT = {
  title: "Restiq Platform Services Agreement",
  body: `This Platform Services Agreement (the "Agreement") is made between the Restiq entity named in the Country Schedule that applies to the Customer ("Restiq", "we", "us") and {{customer.legalName}} of {{customer.address}}, {{customer.country}} (tax registration: {{customer.taxId}}) (the "Customer", "you").

It takes effect on the date it has been signed by both parties (the "Effective Date").

# 1. Definitions

"Authorised User" means an employee or contractor of the Customer whom the Customer allows to use the Services under its account.

"Confidential Information" means information disclosed by one party to the other that is marked confidential or that a reasonable person would understand to be confidential, including the terms of this Agreement.

"Country Schedule" means the schedule at the end of this Agreement for the country in which the Customer is registered.

"Customer Data" means all data, including personal information, that the Customer, its Authorised Users or its guests enter into, upload to or generate through the Services.

"Fees" means the subscription and usage fees for the plan the Customer selects, as shown in its account or order form.

"Payment Services" means card, UPI or other payment processing provided by a third-party payment provider and made available through the Services.

"Services" means the Restiq restaurant platform - point of sale, kitchen display, QR and kiosk self-ordering, owner console, and related hosted software, apps and support - as described in the documentation we make available from time to time.

# 2. The Services

2.1 Subject to this Agreement and payment of the Fees, we grant the Customer a non-exclusive, non-transferable right during the Term for its Authorised Users to access and use the Services for the Customer's own business operations.

2.2 We will provide the Services with reasonable skill and care, and use commercially reasonable efforts to make them available 99.5% of each calendar month, excluding scheduled maintenance notified in advance and events outside our reasonable control.

2.3 We may improve and change the Services. We will not materially reduce the core functionality of the Customer's plan during a billing period the Customer has paid for.

2.4 Offline modes of the point of sale and kitchen display keep data on the Customer's devices until connectivity returns. The Customer is responsible for its devices, local network and internet connection.

# 3. Customer responsibilities

3.1 The Customer must keep account credentials, staff PINs and device enrolment codes confidential, and is responsible for everything done under its account by its Authorised Users.

3.2 The Customer must not: (a) resell, sublicense or provide the Services to third parties; (b) reverse engineer or attempt to access the source code of the Services, except as permitted by law; (c) interfere with the security or operation of the Services; or (d) use the Services for any unlawful purpose.

3.3 The Customer is responsible for the accuracy of its menus, prices, allergen and dietary information, tax settings and receipts, and for complying with the laws that apply to its business, including food safety, consumer protection, tax invoicing and liquor laws.

3.4 The Customer must promptly tell us about any unauthorised use of its account or any security incident it becomes aware of.

# 4. Fees and payment

4.1 The Customer will pay the Fees for its selected plan in advance for each billing period. Fees are exclusive of GST unless the Country Schedule says otherwise.

4.2 Invoices are payable within 14 days of the invoice date. If an amount is overdue, we may suspend access to the Services after giving at least 7 days' written notice, until it is paid.

4.3 We may change the Fees by giving at least 30 days' notice. The change applies from the next billing period, and the Customer may end this Agreement before it takes effect.

4.4 Payment Services are provided by the relevant payment provider under its own terms. Transaction fees, settlement, chargebacks and refunds are governed by those terms. We are not a party to them and do not hold the Customer's funds.

# 5. Customer Data and privacy

5.1 As between the parties, the Customer owns the Customer Data. The Customer grants us a licence to host, copy, process and display Customer Data only as needed to provide, secure and support the Services, and as required by law.

5.2 For personal information in Customer Data, the Customer decides why and how it is processed, and we process it on the Customer's behalf and on its documented instructions, as set out in the Country Schedule.

5.3 We will maintain appropriate technical and organisational security measures, including encryption in transit, access controls, separation of each customer's data, and regular backups.

5.4 We will notify the Customer without undue delay, and in any event within 72 hours, after becoming aware of a security breach affecting Customer Data, and will give reasonable help to meet any notification obligations.

5.5 We may use aggregated, de-identified data that does not identify the Customer, its guests or any individual to operate and improve the Services.

5.6 The Customer may export its Customer Data at any time during the Term and for 30 days after it ends. After that period we will delete it, except where the law requires us to keep it.

# 6. Intellectual property

6.1 We and our licensors own all rights in the Services, the documentation and any improvements to them. No rights are granted except those expressly set out in this Agreement.

6.2 The Customer owns its trade marks, logos, menu content and images, and grants us a licence to use them only to provide the Services.

6.3 If the Customer gives us feedback about the Services, we may use it without restriction or payment.

# 7. Confidentiality

7.1 Each party will keep the other's Confidential Information confidential, use it only to perform this Agreement, and disclose it only to its personnel and advisers who need to know it and are bound by equivalent duties.

7.2 Confidential Information does not include information that is or becomes public other than through a breach of this Agreement, was lawfully known to the recipient beforehand, or is independently developed.

7.3 A party may disclose Confidential Information where required by law or a regulator, after giving the other party notice where it is lawful to do so.

# 8. Warranties

8.1 Each party warrants that it has full power and authority to enter into this Agreement, and that the person signing it is authorised to do so on its behalf.

8.2 Except as expressly stated in this Agreement and subject to the Country Schedule, the Services are provided "as is", and we exclude all other warranties, conditions and representations to the extent permitted by law.

# 9. Liability

9.1 Nothing in this Agreement limits liability for fraud, for death or personal injury caused by negligence, or for any liability that cannot lawfully be limited.

9.2 Neither party is liable for any loss of profits, revenue, goodwill or data, or for any indirect or consequential loss, arising out of this Agreement.

9.3 Each party's total liability arising out of or in connection with this Agreement in any 12-month period is limited to the Fees paid or payable by the Customer in that period. This cap does not apply to the Customer's obligation to pay the Fees, or to a party's liability under clause 10.

# 10. Indemnities

10.1 We will defend the Customer against any third-party claim that the Services infringe that third party's intellectual property rights, and pay any damages finally awarded, provided the Customer notifies us promptly and lets us control the defence.

10.2 The Customer will defend us against any third-party claim arising from Customer Data or from the Customer's breach of clause 3, and pay any damages finally awarded.

# 11. Term and termination

11.1 This Agreement starts on the Effective Date and continues for the Customer's subscription, renewing automatically for successive billing periods unless either party gives notice of non-renewal before the end of the current period (the "Term").

11.2 Either party may end this Agreement by written notice if the other party: (a) materially breaches it and does not remedy the breach within 30 days of notice; or (b) becomes insolvent or is subject to any similar event.

11.3 When this Agreement ends, the Customer's right to use the Services ends, clause 5.6 applies to Customer Data, and Fees due up to the end date remain payable. Clauses 5, 6, 7, 9, 10 and 12 continue after it ends.

# 12. General

12.1 We may publish a new version of this Agreement. We will notify the Customer at least 30 days before it takes effect and ask the Customer to sign it. If the Customer does not accept it, the Customer may end this Agreement before it takes effect.

12.2 Notices must be in writing and sent by email to the address the other party has most recently given for notices. A notice is received when sent, unless the sender receives an automated delivery failure.

12.3 Neither party is liable for delay or failure caused by events beyond its reasonable control.

12.4 The Customer may not assign this Agreement without our consent, which we will not unreasonably withhold. We may assign it to a related entity or to a successor to our business by giving notice.

12.5 This Agreement, the Country Schedule and the Customer's plan selection or order form are the entire agreement between the parties about its subject matter. If they are inconsistent, the Country Schedule prevails.

12.6 This Agreement may be signed electronically and in counterparts. Each party agrees that electronic signatures and electronic records of this Agreement are legally binding.

# Schedule A - Australia

Applies where the Customer's country is Australia.

A1. Restiq entity: [Restiq Australian entity legal name], ABN [ABN], of [registered address].

A2. Governing law: This Agreement is governed by the laws of [New South Wales], Australia. Each party submits to the non-exclusive jurisdiction of the courts of that State and the Commonwealth.

A3. GST: Unless stated otherwise, amounts are exclusive of GST. Where a supply under this Agreement is a taxable supply, the recipient must pay an additional amount equal to the GST on it, on receiving a valid tax invoice, as defined in the A New Tax System (Goods and Services Tax) Act 1999 (Cth).

A4. Privacy: Each party will comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles in handling personal information in Customer Data. Eligible data breaches will be handled under the Notifiable Data Breaches scheme.

A5. Australian Consumer Law: Nothing in this Agreement excludes, restricts or modifies any right, remedy or guarantee under the Competition and Consumer Act 2010 (Cth) that cannot lawfully be excluded. Where our liability for failing to meet such a guarantee may be limited, it is limited to supplying the Services again or paying the cost of having them supplied again.

A6. Electronic signing: The parties consent to signing this Agreement electronically under the Electronic Transactions Act 1999 (Cth) and the corresponding State and Territory laws.

A7. Data location: Customer Data is hosted in [hosting region].

# Schedule B - India

Applies where the Customer's country is India.

B1. Restiq entity: [Restiq Indian entity legal name], CIN [CIN], GSTIN [GSTIN], of [registered address].

B2. Governing law and disputes: This Agreement is governed by the laws of India. A dispute the parties cannot resolve by negotiation within 30 days will be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat of arbitration is [Bengaluru] and the language is English; subject to that Act, the courts at [Bengaluru] have exclusive jurisdiction.

B3. GST and withholding: Fees are exclusive of Goods and Services Tax, which is charged at the applicable rate under the Central Goods and Services Tax Act, 2017 and the related State and Integrated GST laws. The Customer must give us its GSTIN to claim input tax credit. Where the Customer must deduct tax at source, it will provide the certificate within the statutory time.

B4. Data protection: Each party will comply with the Digital Personal Data Protection Act, 2023 and the rules made under it. For personal data in Customer Data, the Customer is the Data Fiduciary and we are its Data Processor: we process personal data only on the Customer's instructions and help it respond to requests from data principals.

B5. Information security: We will maintain reasonable security practices and procedures as required by the Information Technology Act, 2000, and report cyber security incidents as required by CERT-In directions.

B6. Electronic contract: The parties agree that this Agreement may be concluded and signed electronically and is a valid contract under section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872. Any stamp duty payable on this Agreement will be borne by [the Customer].

B7. Data location: Customer Data is hosted in [hosting region].`,
} as const;
