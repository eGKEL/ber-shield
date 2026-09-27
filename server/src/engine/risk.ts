import { Scenario, Signal, DemoEvent } from '../data/scenarios.js';
export const analyze = (scenario: Scenario, activeIds: string[]) => {
 const activeSignals = scenario.signals.filter(s => activeIds.includes(s.id));
 const riskScore = Math.min(100, activeSignals.reduce((sum, s) => sum + s.points, 0));
 const severity = riskScore >= 70 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : riskScore > 0 ? 'LOW' : 'NORMAL';
 return { riskScore, severity, activeSignals, events: scenario.events.filter(e => !e.signalId || activeIds.includes(e.signalId)), recommendedAction: scenario.action };
};
