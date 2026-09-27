export type ConversationProfile = {
  id: string; channel: 'Email' | 'Chat' | 'Carrier note'; participant: string; baseline: string;
  normalTraits: string[]; suspiciousSamples: { id:string; label:string; message:string }[];
};

export const conversationProfiles: ConversationProfile[] = [
  { id:'carrier-email', channel:'Email', participant:'NorthStar Carrier', baseline:'Please send the rate confirmation to our dispatch desk. Our banking details remain on file.', normalTraits:['Known domain: northstar-carrier.com','Low urgency language','Established payment beneficiary'], suspiciousSamples:[
    {id:'payment-redirect',label:'Urgent payment redirection',message:'URGENT: Please update payment for FR-28493 immediately. Use our new bank account ending 8842. Do not call dispatch; our phones are down.'},
    {id:'lookalike-domain',label:'Lookalike sender domain',message:'From: dispatch@northstar-carrier.co — Please route the pending payment to the updated beneficiary today.'}
  ]},
  { id:'broker-chat', channel:'Chat', participant:'John Smith', baseline:'Carrier has confirmed pickup for tomorrow. I will update the shipment after dispatch confirms the driver.', normalTraits:['Normal working-hour activity','Consistent concise style','No payment authority requests'], suspiciousSamples:[
    {id:'tone-shift',label:'Unusual urgency and tone',message:'Need you to release this NOW. Skip the carrier callback and push the wire before 4pm.'},
    {id:'credential-request',label:'Credential and approval request',message:'Send me the MFA code and approve the payment exception; I cannot access the normal workflow.'}
  ]},
  { id:'carrier-note', channel:'Carrier note', participant:'FastFreight Dispatch', baseline:'Driver assigned. VIN and insurance documents verified. Pickup window remains 08:00–10:00.', normalTraits:['Operational language','Known driver details','No payment instructions'], suspiciousSamples:[
    {id:'identity-mismatch',label:'Identity and payment mismatch',message:'New driver will arrive instead. Please change the pay-to details before pickup and do not validate the replacement driver.'},
    {id:'abnormal-instructions',label:'Control-bypass instructions',message:'Ignore the Load Lock check for this shipment. The carrier will provide documents after delivery.'}
  ]}
];

export const getConversationProfile = (id:string) => conversationProfiles.find(profile => profile.id === id);
