export type BrokerBaseline = {
  id: string; identity: string; email: string; shipmentId: string; origin: string; destination: string;
  baselineValue: number; paymentDestination: string; knownIp: string; knownDevice: string; lastApproved: string;
};
export type BrokerChanges = { ipAddress?: string; device?: string; passwordChanged?: boolean; shipmentValue?: number; paymentDestination?: string };
const severityFor = (score:number) => score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : score > 0 ? 'LOW' : 'NORMAL';

export function detectTransactionChange(transaction:BrokerBaseline, changes:BrokerChanges) {
  const signals = [] as {id:string;label:string;points:number;detail:string;category:string}[];
  if (changes.ipAddress && changes.ipAddress !== transaction.knownIp) signals.push({id:'new-ip',label:'New IP address',points:15,detail:changes.ipAddress,category:'Identity'});
  if (changes.device && changes.device !== transaction.knownDevice) signals.push({id:'new-device',label:'Unknown device',points:20,detail:changes.device,category:'Device'});
  if (changes.passwordChanged) signals.push({id:'credential-change',label:'Credential modified',points:20,detail:'Password reset or change in active session',category:'Identity'});
  if (changes.shipmentValue && changes.shipmentValue > transaction.baselineValue * 1.35) signals.push({id:'high-value',label:'High-value shipment',points:15,detail:`$${changes.shipmentValue.toLocaleString()} vs approved baseline $${transaction.baselineValue.toLocaleString()}`,category:'Transaction'});
  if (changes.paymentDestination && changes.paymentDestination !== transaction.paymentDestination) signals.push({id:'payment-change',label:'Payment change',points:30,detail:changes.paymentDestination,category:'Payment'});
  const riskScore = Math.min(100,signals.reduce((sum,signal)=>sum+signal.points,0));
  const severity = severityFor(riskScore);
  const recommendation = riskScore >= 70 ? 'BLOCK' : riskScore >= 50 ? 'ESCALATE' : riskScore >= 30 ? 'REVIEW' : 'ALLOW';
  return { transaction, submitted:{...changes}, riskScore, severity, recommendation, signals, detectedAt:new Date().toISOString(), policyTriggered: signals.length ? 'Identity and transaction change policy' : 'No policy triggered', status: signals.length ? 'DETECTED' : 'APPROVED BASELINE' };
}
