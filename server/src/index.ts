import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scenarios, getScenario } from './data/scenarios.js';
import { analyze } from './engine/risk.js';
import { investigate } from './services/investigation.js';
import { detectTransactionChange } from './services/brokerDetection.js';
import { conversationProfiles, getConversationProfile } from './data/conversations.js';
import { analyzeConversation } from './services/conversationDetection.js';
import { brokerAccount } from './data/brokerAccount.js';
import { investigateBrokerCase } from './services/aiInvestigation.js';
import { approvedInvoices, invoiceScenarios, getInvoiceScenario } from './data/invoices.js';
import { detectInvoiceAnomaly, type InvoiceSignal } from './services/invoiceDetection.js';
import { investigateInvoiceCase } from './services/invoiceInvestigation.js';

const app = express();
app.use(cors());
app.use(express.json());

type BrokerDetection = ReturnType<typeof detectTransactionChange> & {
  caseId: string;
  firstSeen: string;
  lastSeen: string;
};
type BrokerEvent = { at: string; title: string; detail: string; points: number };
type BrokerCaseStatus = 'Action required' | 'Contained' | 'Released' | 'Escalated';

let latestBrokerDetection: BrokerDetection | null = null;
let brokerEvents: BrokerEvent[] = [];
let brokerCaseStatus: BrokerCaseStatus = 'Action required';
let latestConversationDetection: ReturnType<typeof analyzeConversation> | null = null;
type InvoiceDetection = ReturnType<typeof detectInvoiceAnomaly> & { caseId: string; firstSeen: string; lastSeen: string };
type InvoiceCaseStatus = 'Payment hold required' | 'Blocked' | 'Released' | 'Escalated';
let latestInvoiceDetection: InvoiceDetection | null = null;
let invoiceEvents: BrokerEvent[] = [];
let invoiceCaseStatus: InvoiceCaseStatus = 'Payment hold required';

const resolve = (id?: string) => getScenario(id || 'account-takeover');
const severityFor = (score: number) =>
  score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

function recordBrokerDetection(detection: ReturnType<typeof detectTransactionChange>) {
  if (detection.status !== 'DETECTED') return detection;

  const now = detection.detectedAt;
  const isSameCase =
    latestBrokerDetection?.transaction.shipmentId === detection.transaction.shipmentId;
  const signals = new Map(
    isSameCase ? latestBrokerDetection!.signals.map((signal) => [signal.id, signal]) : [],
  );
  const newSignals = detection.signals.filter((signal) => !signals.has(signal.id));
  detection.signals.forEach((signal) => signals.set(signal.id, signal));
  const correlatedSignals = [...signals.values()];
  const riskScore = Math.min(
    100,
    correlatedSignals.reduce((total, signal) => total + signal.points, 0),
  );

  latestBrokerDetection = {
    ...detection,
    signals: correlatedSignals,
    riskScore,
    severity: severityFor(riskScore),
    recommendation: riskScore >= 70 ? 'BLOCK' : riskScore >= 50 ? 'ESCALATE' : 'REVIEW',
    policyTriggered: 'Broker account change correlation policy',
    caseId: isSameCase ? latestBrokerDetection!.caseId : `INC-${new Date(now).getFullYear()}-${detection.transaction.shipmentId}`,
    firstSeen: isSameCase ? latestBrokerDetection!.firstSeen : now,
    lastSeen: now,
  };
  brokerCaseStatus = 'Action required';
  newSignals.forEach((signal) => {
    brokerEvents.unshift({
      at: now,
      title: signal.label,
      detail: signal.detail,
      points: signal.points,
    });
  });
  brokerEvents = brokerEvents.slice(0, 12);
  return latestBrokerDetection;
}

type BrokerSignal = { id: string; label: string; points: number; detail: string; category: string };
function recordBehaviorSignals(shipmentId: string, signals: BrokerSignal[]) {
  const shipment = brokerAccount.shipments.find((item) => item.id === shipmentId) || brokerAccount.shipments[0];
  const riskScore = signals.reduce((total, signal) => total + signal.points, 0);
  const detection = {
    transaction: {
      id: 'broker-' + shipment.id,
      identity: brokerAccount.name,
      email: brokerAccount.email,
      shipmentId: shipment.id,
      origin: shipment.origin,
      destination: shipment.destination,
      baselineValue: shipment.value,
      paymentDestination: shipment.paymentDestination,
      knownIp: brokerAccount.knownIp,
      knownDevice: brokerAccount.knownDevice,
      lastApproved: brokerAccount.lastLogin,
    },
    submitted: {},
    riskScore,
    severity: severityFor(riskScore),
    recommendation: riskScore >= 50 ? 'ESCALATE' : 'REVIEW',
    signals,
    detectedAt: new Date().toISOString(),
    policyTriggered: signals.length ? 'Behavioral anomaly correlation policy' : 'No policy triggered',
    status: signals.length ? 'DETECTED' : 'APPROVED BASELINE',
  };
  return recordBrokerDetection(detection);
}

function recordInvoiceDetection(detection: ReturnType<typeof detectInvoiceAnomaly>) {
  if (detection.status !== 'DETECTED') return detection;
  const now = detection.detectedAt;
  const isSameCase = latestInvoiceDetection?.invoice.shipmentId === detection.invoice.shipmentId;
  const collected = new Map<string, InvoiceSignal>(isSameCase ? latestInvoiceDetection!.signals.map((signal) => [signal.id, signal]) : []);
  const newSignals = detection.signals.filter((signal) => !collected.has(signal.id));
  detection.signals.forEach((signal) => collected.set(signal.id, signal));
  const signals = [...collected.values()];
  const riskScore = Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0));
  latestInvoiceDetection = {
    ...detection,
    signals,
    riskScore,
    severity: severityFor(riskScore),
    recommendation: riskScore >= 70 ? 'BLOCK' : riskScore >= 50 ? 'ESCALATE' : 'REVIEW',
    caseId: isSameCase ? latestInvoiceDetection!.caseId : `INVCASE-${new Date(now).getFullYear()}-${detection.invoice.shipmentId}`,
    firstSeen: isSameCase ? latestInvoiceDetection!.firstSeen : now,
    lastSeen: now,
  };
  invoiceCaseStatus = 'Payment hold required';
  newSignals.forEach((signal) => invoiceEvents.unshift({ at: now, title: signal.label, detail: signal.detail, points: signal.points }));
  invoiceEvents = invoiceEvents.slice(0, 12);
  return latestInvoiceDetection;
}

app.get('/api/health', (_req, res) =>
  res.json({ status: 'operational', service: 'BER Shield ITDR' }),
);
app.get('/api/scenarios', (_req, res) =>
  res.json(scenarios.map(({ signals, events, ...scenario }) => ({
    ...scenario,
    signalCount: signals.length,
    eventCount: events.length,
  }))),
);
app.get('/api/scenarios/:id', (req, res) => {
  const scenario = resolve(req.params.id);
  return scenario ? res.json(scenario) : res.status(404).json({ error: 'Scenario not found' });
});
app.get('/api/conversations/profiles', (_req, res) => res.json(conversationProfiles));
app.get('/api/conversations/latest', (_req, res) => res.json(latestConversationDetection));
app.post('/api/conversations/analyze', (req, res) => {
  const profile = getConversationProfile(req.body.profileId);
  if (!profile) return res.status(404).json({ error: 'Conversation profile not found' });
  const result = analyzeConversation(profile, req.body.message || profile.baseline);
  if (result.status === 'DETECTED') latestConversationDetection = result;
  return res.json(result);
});

app.get('/api/broker/account', (_req, res) => res.json(brokerAccount));
app.get('/api/invoices/baseline', (_req, res) => res.json({ approvedInvoices, scenarios: invoiceScenarios }));
app.get('/api/invoices/monitor', (_req, res) => res.json({ status: 'MONITORING', lastChecked: new Date().toISOString(), detection: latestInvoiceDetection, events: invoiceEvents, caseStatus: latestInvoiceDetection ? invoiceCaseStatus : null }));
app.post('/api/invoices/submit', (req, res) => {
  const scenario = getInvoiceScenario(req.body.scenarioId);
  if (!scenario) return res.status(404).json({ error: 'Invoice scenario not found' });
  const detection = recordInvoiceDetection(detectInvoiceAnomaly(scenario.invoice));
  return res.json({ scenario, detection });
});
app.post('/api/invoices/case/analysis', async (_req, res) => {
  if (!latestInvoiceDetection) return res.status(404).json({ error: 'No active invoice case' });
  return res.json(await investigateInvoiceCase(latestInvoiceDetection));
});
app.post('/api/invoices/case/action', (req, res) => {
  if (!latestInvoiceDetection) return res.status(404).json({ error: 'No active invoice case' });
  const action = String(req.body.action || '').toUpperCase();
  const statuses: Record<string, InvoiceCaseStatus> = { BLOCK: 'Blocked', ALLOW: 'Released', ESCALATE: 'Escalated' };
  if (!statuses[action]) return res.status(400).json({ error: 'Unsupported action' });
  invoiceCaseStatus = statuses[action];
  invoiceEvents.unshift({ at: new Date().toISOString(), title: `Human action: ${action}`, detail: `Maya Patel marked ${latestInvoiceDetection.caseId} as ${invoiceCaseStatus.toLowerCase()}.`, points: 0 });
  invoiceEvents = invoiceEvents.slice(0, 12);
  return res.json({ action, caseStatus: invoiceCaseStatus });
});
app.get('/api/broker/latest-detection', (_req, res) => res.json(latestBrokerDetection));
app.get('/api/broker/monitor', (_req, res) =>
  res.json({
    status: 'MONITORING',
    lastChecked: new Date().toISOString(),
    detection: latestBrokerDetection,
    events: brokerEvents,
    caseStatus: latestBrokerDetection ? brokerCaseStatus : null,
  }),
);
app.post('/api/broker/session/interaction', (req, res) => {
  const detection = recordBehaviorSignals(req.body.shipmentId || 'FR-28491', [
    {
      id: 'irregular-click-burst',
      label: 'Irregular click pattern',
      points: 15,
      detail: '46 rapid clicks across unrelated shipment controls in 18 seconds',
      category: 'Behavior',
    },
  ]);
  return res.json({ detection, heatmap: [0, 1, 0, 3, 1, 0, 2, 6, 4, 1, 0, 3, 1, 5, 2, 0] });
});
app.post('/api/broker/driver-chat', (req, res) => {
  const message = String(req.body.message || '');
  const text = message.toLowerCase();
  const signals: BrokerSignal[] = [];
  if (/(hurry|urgent|immediately|asap|rush)/.test(text)) {
    signals.push({ id: 'urgent-language', label: 'Unusual urgency language', points: 10, detail: 'Driver message uses urgency language outside the established conversation baseline', category: 'Communication' });
  }
  if (/(skip|bypass|without confirmation|do not confirm)/.test(text)) {
    signals.push({ id: 'workflow-bypass-request', label: 'Workflow bypass request', points: 15, detail: 'Driver message requests a change without normal dispatch confirmation', category: 'Communication' });
  }
  if (signals.length) {
    signals.push({ id: 'speech-behavior-shift', label: 'Speech behavior change', points: 10, detail: 'Tone and instruction pattern deviate from the driver’s normal check-in messages', category: 'Communication' });
  }
  const detection = recordBehaviorSignals(req.body.shipmentId || 'FR-28491', signals);
  return res.json({ detection, message, suspicious: signals.length > 0 });
});
app.post('/api/broker/case/analysis', async (_req, res) => {
  if (!latestBrokerDetection) return res.status(404).json({ error: 'No active broker case' });
  const { riskScore, signals, transaction } = latestBrokerDetection;
  const recommendedAction = riskScore >= 70 ? 'BLOCK ACCOUNT CHANGES' : riskScore >= 50 ? 'ESCALATE CASE' : 'REVIEW BEFORE RELEASE';
  return res.json(await investigateBrokerCase({
    riskScore,
    severity: latestBrokerDetection.severity,
    recommendation: latestBrokerDetection.recommendation,
    transaction,
    signals,
  }));
});
app.post('/api/broker/case/action', (req, res) => {
  if (!latestBrokerDetection) return res.status(404).json({ error: 'No active broker case' });
  const action = String(req.body.action || '').toUpperCase();
  const status: Record<string, BrokerCaseStatus> = {
    BLOCK: 'Contained',
    ALLOW: 'Released',
    ESCALATE: 'Escalated',
  };
  if (!status[action]) return res.status(400).json({ error: 'Unsupported action' });
  brokerCaseStatus = status[action];
  brokerEvents.unshift({
    at: new Date().toISOString(),
    title: `Human action: ${action}`,
    detail: `Maya Patel marked ${latestBrokerDetection.caseId} as ${brokerCaseStatus.toLowerCase()}.`,
    points: 0,
  });
  brokerEvents = brokerEvents.slice(0, 12);
  return res.json({ action, caseStatus: brokerCaseStatus });
});
app.post('/api/broker/shipments/:id/update', (req, res) => {
  const shipment = brokerAccount.shipments.find((item) => item.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

  const { value, paymentDestination, status } = req.body;
  const baseline = shipment.value;
  const changes: {
    ipAddress?: string;
    device?: string;
    passwordChanged?: boolean;
    shipmentValue?: number;
    paymentDestination?: string;
  } = {};

  if (typeof value === 'number' && value !== baseline) {
    shipment.value = value;
    changes.shipmentValue = value;
  }
  if (paymentDestination && paymentDestination !== shipment.paymentDestination) {
    shipment.paymentDestination = paymentDestination;
    changes.paymentDestination = paymentDestination;
  }
  if (status) shipment.status = status;

  const baselineTransaction = {
    id: 'broker-' + shipment.id,
    identity: brokerAccount.name,
    email: brokerAccount.email,
    shipmentId: shipment.id,
    origin: shipment.origin,
    destination: shipment.destination,
    baselineValue: baseline,
    paymentDestination: changes.paymentDestination ? 'Approved beneficiary' : shipment.paymentDestination,
    knownIp: brokerAccount.knownIp,
    knownDevice: brokerAccount.knownDevice,
    lastApproved: brokerAccount.lastLogin,
  };
  const rawDetection = detectTransactionChange(baselineTransaction, changes);
  const detection = recordBrokerDetection(rawDetection);
  const event = {
    type: changes.paymentDestination
      ? 'Payment destination updated'
      : changes.shipmentValue
        ? 'Shipment value updated'
        : 'Shipment status updated',
    shipmentId: shipment.id,
    detail: changes.paymentDestination || (changes.shipmentValue ? `$${changes.shipmentValue.toLocaleString()}` : shipment.status),
    at: new Date().toISOString(),
    status: detection.status,
  };
  return res.json({ shipment, detection, event });
});

app.post('/api/risk/analyze', (req, res) => {
  const scenario = resolve(req.body.scenarioId);
  return scenario
    ? res.json(analyze(scenario, req.body.activeSignalIds || []))
    : res.status(404).json({ error: 'Scenario not found' });
});
app.post('/api/investigate', (req, res) => {
  const scenario = resolve(req.body.scenarioId);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  const risk = analyze(scenario, req.body.activeSignalIds || scenario.signals.map((signal) => signal.id));
  return res.json(investigate(scenario, risk.activeSignals, risk.riskScore));
});
app.post('/api/actions/:action', (req, res) => {
  const action = req.params.action?.toUpperCase();
  if (!['BLOCK', 'ALLOW', 'ESCALATE'].includes(action)) {
    return res.status(400).json({ error: 'Unsupported action' });
  }
  const scenario = resolve(req.body.scenarioId);
  return res.json({
    action,
    status: action === 'BLOCK' ? 'CONTAINED' : action === 'ALLOW' ? 'RELEASED' : 'ESCALATED',
    at: new Date().toISOString(),
    shipment: scenario?.shipment,
  });
});

app.listen(3001, () => console.log('BER Shield API running on http://localhost:3001'));
