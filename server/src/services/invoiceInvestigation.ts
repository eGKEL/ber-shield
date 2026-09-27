import type { InvoiceSignal } from './invoiceDetection.js';

type InvoiceCase = { riskScore: number; severity: string; recommendation: string; invoice: { invoiceNumber: string; shipmentId: string; carrier: string; amount: number; paymentDestination: string }; signals: InvoiceSignal[] };

const fallback = (caseData: InvoiceCase) => ({
  confidence: Math.min(97, 76 + caseData.signals.length * 6),
  classification: 'Invoice integrity anomaly',
  summary: `${caseData.invoice.invoiceNumber} has ${caseData.signals.length} correlated integrity findings linked to shipment ${caseData.invoice.shipmentId}. The ${caseData.severity.toLowerCase()} risk assessment is driven by ${caseData.signals.map((signal) => signal.category.toLowerCase()).filter((value, index, list) => list.indexOf(value) === index).join(', ')} evidence; hold payment pending verification.`,
  evidence: caseData.signals.map((signal) => `${signal.label} (+${signal.points})`),
  recommendedAction: caseData.recommendation === 'BLOCK' ? 'BLOCK INVOICE PAYMENT' : caseData.recommendation === 'ESCALATE' ? 'ESCALATE TO AP' : 'REVIEW BEFORE PAYMENT',
  provider: 'Local behavioral model', model: 'BER invoice classifier',
});

export async function investigateInvoiceCase(caseData: InvoiceCase) {
  const local = fallback(caseData);
  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  try {
    const response = await fetch(`${host}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ model, stream: false, options: { temperature: 0.1, num_predict: 160 }, messages: [{ role: 'system', content: 'You are a logistics accounts-payable security investigator. Return a concise factual 2-3 sentence executive summary using only supplied evidence.' }, { role: 'user', content: JSON.stringify(caseData) }] }) });
    if (!response.ok) return local;
    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content?.trim() ? { ...local, summary: data.message.content.trim(), provider: 'Local Qwen', model } : local;
  } catch { return local; }
}
