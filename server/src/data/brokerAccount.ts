export type BrokerAccount = {
  id:string; name:string; email:string; company:string; role:string; lastLogin:string; knownIp:string; knownDevice:string;
  shipments:{id:string; origin:string; destination:string; value:number; status:string; paymentDestination:string}[];
};

export const brokerAccount:BrokerAccount = {
  id:'broker-john-smith', name:'John Smith', email:'john@fastfreight.com', company:'FastFreight Logistics', role:'Freight Broker',
  lastLogin:'2026-09-27 08:12:03', knownIp:'198.51.100.24 · Dallas, US', knownDevice:'Chrome 128 · macOS',
  shipments:[
    {id:'FR-28491',origin:'Dallas, TX',destination:'Miami, FL',value:42000,status:'Ready to tender',paymentDestination:'First National ·•••• 4419'},
    {id:'FR-28492',origin:'Chicago, IL',destination:'Phoenix, AZ',value:36800,status:'Carrier assigned',paymentDestination:'Midwest Bank ·•••• 8872'},
    {id:'FR-28493',origin:'Atlanta, GA',destination:'Nashville, TN',value:46750,status:'Awaiting payment',paymentDestination:'NorthStar Carrier ·•••• 2091'}
  ]
};
