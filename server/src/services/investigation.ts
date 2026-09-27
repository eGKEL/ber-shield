import { Scenario } from '../data/scenarios.js';
export const investigate = (scenario: Scenario, activeSignals: {label:string; detail:string}[], riskScore:number) => ({
 threatType: scenario.threatType, confidence: Math.min(98, Math.max(78, riskScore)),
 summary: `The ${scenario.user.name} account shows a correlated sequence of identity and operational anomalies consistent with ${scenario.threatType.toLowerCase()}. ${scenario.context}`,
 reconstruction: activeSignals.map((signal, index) => ({ step: index + 1, text: `${signal.label}: ${signal.detail}.` })),
 evidence: activeSignals.map(signal => ({ label: signal.label, detail: signal.detail })),
 recommendedAction: scenario.action === 'BLOCK' ? 'BLOCK TRANSACTION' : 'ESCALATE FOR REVIEW',
 rationale: scenario.action === 'BLOCK' ? 'The combination of identity, device, shipment and payment anomalies meets the containment threshold.' : 'The activity is high risk but is attributable to an authorized identity; human review is required before containment.',
 provider: 'deterministic-demo-fallback'
});
