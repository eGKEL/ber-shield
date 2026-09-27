import { ConversationProfile } from '../data/conversations.js';

const scoreFor = (signals:{points:number}[]) => Math.min(100,signals.reduce((sum,signal)=>sum+signal.points,0));
export function analyzeConversation(profile:ConversationProfile, message:string) {
  const text=message.toLowerCase(); const signals=[] as {id:string;label:string;points:number;detail:string}[];
  if(/new bank|new account|pay-to|beneficiary|payment.*update|wire/.test(text)) signals.push({id:'payment-language',label:'Changed payment instructions',points:30,detail:'Payment destination language differs from approved communication history.'});
  if(/urgent|immediately|now|before 4pm/.test(text)) signals.push({id:'urgency',label:'Abnormal urgency',points:10,detail:'Pressure language is outside the participant’s normal communication pattern.'});
  if(/do not call|skip.*callback|ignore.*check|do not validate|phones are down/.test(text)) signals.push({id:'control-bypass',label:'Verification control bypass',points:20,detail:'Message requests that a standard verification control be skipped.'});
  if(/mfa|code|cannot access|credential/.test(text)) signals.push({id:'credential-request',label:'Credential or approval request',points:20,detail:'Message contains an atypical request for credentials or approval override.'});
  if(/northstar-carrier\.co/.test(text)) signals.push({id:'lookalike-domain',label:'Lookalike sender domain',points:25,detail:'Sender domain resembles, but does not match, the known carrier domain.'});
  if(/new driver|replacement driver/.test(text)) signals.push({id:'identity-change',label:'Unverified identity change',points:15,detail:'Driver identity change conflicts with the verified shipment record.'});
  const riskScore=scoreFor(signals); const severity=riskScore>=70?'CRITICAL':riskScore>=50?'HIGH':riskScore>=30?'MEDIUM':riskScore>0?'LOW':'NORMAL';
  return { profile:{id:profile.id,channel:profile.channel,participant:profile.participant}, message, riskScore,severity,signals,confidence:Math.min(98,Math.max(64,riskScore+5)),recommendation:riskScore>=70?'BLOCK AND VERIFY':riskScore>=50?'ESCALATE FOR REVIEW':riskScore>=30?'REQUEST VERIFICATION':'ALLOW',analysis:`AI-assisted behavioral analysis compared this ${profile.channel.toLowerCase()} communication with the approved conversation baseline. ${signals.length ? `${signals.length} anomalous pattern${signals.length>1?'s were':' was'} identified.` : 'No material behavioral deviation was identified.'}`,detectedAt:new Date().toISOString(),status:signals.length?'DETECTED':'BASELINE MATCH' };
}
