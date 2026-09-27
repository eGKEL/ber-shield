import { approvedInvoices, type ApprovedInvoice } from '../data/invoices.js';

export type InvoiceSignal = { id: string; label: string; points: number; detail: string; category: string };

const severityFor = (score: number) => score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

export function detectInvoiceAnomaly(invoice: ApprovedInvoice) {
  const signals: InvoiceSignal[] = [];
  const exact = approvedInvoices.find((item) => item.invoiceNumber === invoice.invoiceNumber);
  const shipmentBaseline = approvedInvoices.find((item) => item.shipmentId === invoice.shipmentId);

  if (exact) signals.push({ id: 'exact-duplicate', label: 'Exact invoice duplicate', points: 55, detail: `${invoice.invoiceNumber} was already approved for ${invoice.shipmentId}.`, category: 'Duplicate' });
  if (!exact && shipmentBaseline) signals.push({ id: 'shipment-rebilling', label: 'Shipment billed again', points: 30, detail: `${invoice.shipmentId} already has approved invoice ${shipmentBaseline.invoiceNumber}.`, category: 'Duplicate' });
  if (shipmentBaseline && invoice.invoiceNumber !== shipmentBaseline.invoiceNumber && invoice.amount === shipmentBaseline.amount) signals.push({ id: 'near-duplicate-reference', label: 'Near-duplicate invoice reference', points: 20, detail: `Invoice reference differs from ${shipmentBaseline.invoiceNumber} while shipment and amount match.`, category: 'Duplicate' });
  if (shipmentBaseline && invoice.amount > shipmentBaseline.amount) {
    const variance = Math.round(((invoice.amount - shipmentBaseline.amount) / shipmentBaseline.amount) * 100);
    signals.push({ id: 'amount-variance', label: 'Invoice amount variance', points: 30, detail: `${variance}% above the approved ${shipmentBaseline.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} baseline.`, category: 'Financial' });
  }
  if (shipmentBaseline && invoice.paymentDestination !== shipmentBaseline.paymentDestination) signals.push({ id: 'new-payment-destination', label: 'Unapproved payment destination', points: 35, detail: `${invoice.paymentDestination} is not the approved beneficiary for ${invoice.carrier}.`, category: 'Payment' });
  if (invoice.deliveryStatus !== 'Delivered') signals.push({ id: 'delivery-not-confirmed', label: 'Delivery not confirmed', points: 20, detail: `Shipment ${invoice.shipmentId} is still marked ${invoice.deliveryStatus.toLowerCase()}.`, category: 'Fulfillment' });

  const riskScore = Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0));
  return {
    invoice,
    signals,
    riskScore,
    severity: severityFor(riskScore),
    recommendation: riskScore >= 70 ? 'BLOCK' : riskScore >= 50 ? 'ESCALATE' : 'REVIEW',
    status: signals.length ? 'DETECTED' : 'APPROVED BASELINE',
    detectedAt: new Date().toISOString(),
    policyTriggered: signals.length ? 'Invoice integrity and payment verification policy' : 'No policy triggered',
  };
}
