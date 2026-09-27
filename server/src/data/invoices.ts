export type ApprovedInvoice = {
  invoiceNumber: string;
  shipmentId: string;
  carrier: string;
  amount: number;
  paymentDestination: string;
  issuedAt: string;
  deliveryStatus: 'Delivered' | 'In transit';
};

export type InvoiceScenario = {
  id: string;
  label: string;
  description: string;
  invoice: ApprovedInvoice;
};

export const approvedInvoices: ApprovedInvoice[] = [
  { invoiceNumber: 'INV-FF-1042', shipmentId: 'FR-28491', carrier: 'NorthStar Freight', amount: 45200, paymentDestination: 'NorthStar ·•••• 1128', issuedAt: '2026-09-24', deliveryStatus: 'Delivered' },
  { invoiceNumber: 'INV-FF-1043', shipmentId: 'FR-28507', carrier: 'BlueLine Transport', amount: 28750, paymentDestination: 'BlueLine ·•••• 4017', issuedAt: '2026-09-25', deliveryStatus: 'Delivered' },
  { invoiceNumber: 'INV-FF-1044', shipmentId: 'FR-28518', carrier: 'Continental Haulage', amount: 31800, paymentDestination: 'Continental ·•••• 7091', issuedAt: '2026-09-26', deliveryStatus: 'In transit' },
];

export const invoiceScenarios: InvoiceScenario[] = [
  {
    id: 'exact-duplicate',
    label: 'Submit exact duplicate',
    description: 'Same invoice number and same shipment as an approved payment.',
    invoice: { ...approvedInvoices[0], issuedAt: '2026-09-27' },
  },
  {
    id: 'near-duplicate',
    label: 'Submit near-duplicate',
    description: 'A similar invoice number is billed again against the same shipment.',
    invoice: { ...approvedInvoices[0], invoiceNumber: 'INV-FF-1042-R', issuedAt: '2026-09-27' },
  },
  {
    id: 'inflated-amount',
    label: 'Submit inflated invoice',
    description: 'Invoice amount exceeds the approved shipment amount by 43%.',
    invoice: { ...approvedInvoices[1], invoiceNumber: 'INV-FF-1051', amount: 41200, issuedAt: '2026-09-27' },
  },
  {
    id: 'new-bank-account',
    label: 'Submit bank change',
    description: 'Otherwise familiar invoice with an unapproved payment destination.',
    invoice: { ...approvedInvoices[2], invoiceNumber: 'INV-FF-1052', paymentDestination: 'Wire beneficiary ·•••• 8842', issuedAt: '2026-09-27' },
  },
  {
    id: 'before-delivery',
    label: 'Submit pre-delivery invoice',
    description: 'Invoice requests payment before delivery confirmation is recorded.',
    invoice: { ...approvedInvoices[2], invoiceNumber: 'INV-FF-1053', deliveryStatus: 'In transit', issuedAt: '2026-09-27' },
  },
];

export const getInvoiceScenario = (id?: string) => invoiceScenarios.find((item) => item.id === id);
