/**
 * WeChat Work (企业微信) API Integration
 * Handles external contact management and messaging
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

const router = Router();
const prisma = new PrismaClient();
// ─── WeCom Config Management ───

function getUserId(req) { return req.userId || 1; }

async function getWeComConfig(userId) {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: 'wecom_config' } },
  });
  if (!setting || !setting.value) return null;
  try {
    const raw = isEncrypted(setting.value) ? decrypt(setting.value) : setting.value;
    return JSON.parse(raw);
  } catch { return null; }
}

async function saveWeComConfig(userId, config) {
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: 'wecom_config' } },
    create: { userId, key: 'wecom_config', value: encrypt(JSON.stringify(config)) },
    update: { value: encrypt(JSON.stringify(config)) },
  });
}

// Get WeCom config (masked)
router.get('/config', async (req, res) => {
  try {
    const config = await getWeComConfig(getUserId(req));
    if (!config) return res.json({ configured: false });
    res.json({
      configured: true,
      corpId: config.corpId,
      corpSecret: config.corpSecret ? '****' + config.corpSecret.slice(-4) : '',
      agentId: config.agentId || '',
      callbackToken: config.callbackToken ? '****' : '',
      callbackEncodingAesKey: config.callbackEncodingAesKey ? '****' : '',
      syncedAt: config.syncedAt || null,
      contactCount: config.contactCount || 0,
    });
  } catch (err) {
    console.error('[WeCom] Get config error:', err);
    res.status(500).json({ error: '获取企微配置失败' });
  }
});

// Save WeCom config
router.put('/config', async (req, res) => {
  try {
    const { corpId, corpSecret, agentId, callbackToken, callbackEncodingAesKey } = req.body;
    if (!corpId || !corpSecret) {
      return res.status(400).json({ error: 'CorpID和CorpSecret为必填' });
    }
    const existing = await getWeComConfig(getUserId(req)) || {};
    const config = {
      corpId,
      corpSecret: corpSecret.includes('****') ? existing.corpSecret : corpSecret,
      agentId: agentId || existing.agentId || '',
      callbackToken: callbackToken || existing.callbackToken || '',
      callbackEncodingAesKey: callbackEncodingAesKey || existing.callbackEncodingAesKey || '',
      updatedAt: new Date().toISOString(),
    };
    await saveWeComConfig(getUserId(req), config);
    res.json({ success: true, message: '企微配置已保存' });
  } catch (err) {
    console.error('[WeCom] Save config error:', err);
    res.status(500).json({ error: '保存企微配置失败' });
  }
});

// ─── WeCom API Proxy ───

// Get access token from WeCom API
async function getWeComAccessToken(userId) {
  const config = await getWeComConfig(userId);
  if (!config || !config.corpId || !config.corpSecret) {
    throw new Error('企微配置不完整，请先配置CorpID和CorpSecret');
  }
  
  // Check cached token
  const cached = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: 'wecom_access_token' } },
  });
  if (cached?.value) {
    try {
      const tokenData = JSON.parse(isEncrypted(cached.value) ? decrypt(cached.value) : cached.value);
      if (tokenData.expiresAt > Date.now()) {
        return tokenData.accessToken;
      }
    } catch {}
  }
  
  // Fetch new token
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.corpId}&corpsecret=${config.corpSecret}`;
  const resp = await fetch(url);
  const data = await resp.json();
  
  if (data.errcode !== 0) {
    throw new Error(`获取企微access_token失败: ${data.errmsg} (${data.errcode})`);
  }
  
  const tokenData = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 提前5分钟过期
  };
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: 'wecom_access_token' } },
    create: { userId, key: 'wecom_access_token', value: encrypt(JSON.stringify(tokenData)) },
    update: { value: encrypt(JSON.stringify(tokenData)) },
  });
  
  return data.access_token;
}

// Test connection
router.get('/test', async (req, res) => {
  try {
    const token = await getWeComAccessToken();
    res.json({ success: true, message: '企微连接成功', tokenPreview: token.substring(0, 10) + '...' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Sync external contacts
router.post('/sync-contacts', async (req, res) => {
  try {
    const token = await getWeComAccessToken(userId);
    const config = await getWeComConfig(userId);
    
    // Step 1: Get follow-user list (get follow users who have external contacts)
    const followResp = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get_follow_user_list?access_token=${token}`);
    const followData = await followResp.json();
    
    if (followData.errcode !== 0) {
      return res.status(400).json({ error: `获取跟进用户列表失败: ${followData.errmsg}` });
    }
    
    const followUsers = followData.follow_user || [];
    let allContacts = [];
    
    // Step 2: For each follow user, get their external contacts
    for (const userId of followUsers) {
      try {
        const listResp = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?access_token=${token}&userid=${userId}`);
        const listData = await listResp.json();
        
        if (listData.errcode === 0 && listData.external_userid) {
          // Step 3: Get details for each contact
          for (const extUserId of listData.external_userid) {
            try {
              const detailResp = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get?access_token=${token}&external_userid=${extUserId}`);
              const detailData = await detailResp.json();
              
              if (detailData.errcode === 0 && detailData.external_contact) {
                const contact = detailData.external_contact;
                allContacts.push({
                  wecomUserId: contact.userid || extUserId,
                  name: contact.name || '',
                  avatar: contact.avatar || '',
                  type: contact.type === 1 ? 'wechat' : 'wecom',
                  gender: contact.gender,
                  unionid: contact.unionid || '',
                  corpName: contact.corp_name || '',
                  corpFullName: contact.corp_full_name || '',
                });
              }
            } catch (e) {
              console.warn(`Failed to get contact ${extUserId}:`, e.message);
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to list contacts for ${userId}:`, e.message);
      }
    }
    
    // Step 4: Save/update partners from WeChat contacts
    const tenantId = req.tenantId || 1;
    let created = 0, updated = 0;
    
    for (const contact of allContacts) {
      const existing = await prisma.partner.findFirst({
        where: { tenantId, wecomUserId: contact.wecomUserId },
      });
      
      if (existing) {
        await prisma.partner.update({
          where: { id: existing.id },
          data: { wecomName: contact.name },
        });
        updated++;
      } else {
        await prisma.partner.create({
          data: {
            tenantId,
            type: 'factory', // default type, user can change later
            companyName: contact.corpName || contact.name || 'Unknown',
            contactName: contact.name,
            wecomUserId: contact.wecomUserId,
            wecomName: contact.name,
            notes: `从企微同步 | 类型:${contact.type} | 企业:${contact.corpFullName || contact.corpName}`,
          },
        });
        created++;
      }
    }
    
    // Update sync timestamp
    const cfg = await getWeComConfig(userId);
    cfg.syncedAt = new Date().toISOString();
    cfg.contactCount = allContacts.length;
    await saveWeComConfig(userId, cfg);
    
    res.json({
      success: true,
      synced: allContacts.length,
      created,
      updated,
      message: `同步完成: 共${allContacts.length}个外部联系人，新增${created}个，更新${updated}个`,
    });
  } catch (err) {
    console.error('[WeCom] Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message to external contact via WeCom
router.post('/send-message', async (req, res) => {
  try {
    const { partnerId, content, msgType } = req.body;
    if (!partnerId || !content) {
      return res.status(400).json({ error: 'partnerId和content为必填' });
    }
    
    const partner = await prisma.partner.findFirst({
      where: { id: partnerId, tenantId: req.tenantId || 1 },
    });
    if (!partner || !partner.wecomUserId) {
      return res.status(400).json({ error: '合作伙伴不存在或未关联企微联系人' });
    }
    
    const token = await getWeComAccessToken(userId);
    const config = await getWeComConfig(userId);
    
    // Send external contact message
    const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/send_welcome_msg?access_token=${token}`;
    // Actually, for sending messages to external contacts, we use the customer message API
    const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    
    // For external contact messages, we need to use the "发送客户群发" or "个人消息" API
    // The simplest approach is to use the external contact message template
    const resp = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_msg_template?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_type: 'single',
        external_userid: partner.wecomUserId,
        sender: config.agentId, // 发送企业成员userid
        text: { content },
      }),
    });
    const data = await resp.json();
    
    if (data.errcode !== 0) {
      // Fallback: just save the message locally for manual sending
      await prisma.partnerMessage.create({
        data: {
          tenantId: req.tenantId || 1,
          partnerId,
          direction: 'outbound',
          channel: 'manual',
          content,
          aiGenerated: req.body.aiGenerated || false,
        },
      });
      return res.json({ 
        success: true, 
        saved: true,
        message: `消息已保存（企微发送失败: ${data.errmsg}，请手动发送）`,
      });
    }
    
    // Save sent message
    await prisma.partnerMessage.create({
      data: {
        tenantId: req.tenantId || 1,
        partnerId,
        direction: 'outbound',
        channel: 'wecom',
        content,
        aiGenerated: req.body.aiGenerated || false,
      },
    });
    
    res.json({ success: true, message: '消息已通过企微发送' });
  } catch (err) {
    console.error('[WeCom] Send message error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete WeCom config
router.delete('/config', async (req, res) => {
  try {
    await prisma.setting.deleteMany({
      where: { userId, key: { in: ['wecom_config', 'wecom_access_token'] } },
    });
    res.json({ success: true, message: '企微配置已清除' });
  } catch (err) {
    res.status(500).json({ error: '清除配置失败' });
  }
});

export default router;
