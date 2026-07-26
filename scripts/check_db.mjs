import { PrismaClient } from "/opt/whatsapp-crm/backend/node_modules/@prisma/client/index.js";
const p = new PrismaClient();
const total = await p.wAMessage.count();
const oldest = await p.wAMessage.findFirst({orderBy:{timestamp:'asc'},select:{timestamp:true,body:true,direction:true}});
const newest = await p.wAMessage.findFirst({orderBy:{timestamp:'desc'},select:{timestamp:true,body:true,direction:true}});
console.log('DB总消息数:', total);
console.log('最早:', oldest?.timestamp?.toISOString(), oldest?.direction, oldest?.body?.slice(0,40));
console.log('最新:', newest?.timestamp?.toISOString(), newest?.direction, newest?.body?.slice(0,40));

// 检查每个会话的出站/入站情况
const jids = await p.wAMessage.findMany({select:{from:true,to:true,direction:true},distinct:['from']});
const allMsgs = await p.wAMessage.findMany({select:{from:true,to:true,direction:true,timestamp:true,read:true},orderBy:{timestamp:'asc'}});
const convos = {};
for (const m of allMsgs) {
  const jid = m.direction==='inbound' ? m.from : m.to;
  if (!convos[jid]) convos[jid] = {inbound:0,outbound:0,lastInbound:null,lastOutbound:null,unreadInbound:0};
  if (m.direction==='inbound') {
    convos[jid].inbound++;
    convos[jid].lastInbound = m.timestamp;
    if (!m.read) convos[jid].unreadInbound++;
  } else {
    convos[jid].outbound++;
    convos[jid].lastOutbound = m.timestamp;
  }
}
console.log('\n各会话状态:');
for (const [jid,s] of Object.entries(convos)) {
  if (jid.includes('@lid')) {
    // resolve
  }
  const lastIn = s.lastInbound?.toISOString().slice(5,16);
  const lastOut = s.lastOutbound?.toISOString().slice(5,16);
  const reallyUnread = s.lastInbound && (!s.lastOutbound || s.lastInbound > s.lastOutbound);
  console.log(`  ${jid.slice(0,35)} 入${s.inbound} 出${s.outbound} 未读入站=${s.unreadInbound} 真未回=${reallyUnread?'YES':'no'} lastIn=${lastIn} lastOut=${lastOut}`);
}
await p.$disconnect();
