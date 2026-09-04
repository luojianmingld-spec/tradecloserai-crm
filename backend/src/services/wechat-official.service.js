/**
 * 微信公众号（认证服务号）推送服务
 */

import axios from 'axios';
import crypto from 'crypto';

const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID,
  appSecret: process.env.WECHAT_APP_SECRET,
};

let accessTokenCache = {
  token: null,
  expiresAt: 0,
};

async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now + 5 * 60 * 1000) {
    return accessTokenCache.token;
  }

  try {
    const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.appSecret,
      },
    });

    if (response.data.errcode) {
      throw new Error(`获取access_token失败: ${response.data.errmsg}`);
    }

    accessTokenCache = {
      token: response.data.access_token,
      expiresAt: now + response.data.expires_in * 1000,
    };

    console.log('[WeChat] access_token 已更新');
    return accessTokenCache.token;
  } catch (err) {
    console.error('[WeChat] 获取access_token失败:', err.message);
    throw err;
  }
}

async function generateQRCode(sceneStr, expireSeconds = 7 * 24 * 3600) {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${accessToken}`,
      {
        expire_seconds: expireSeconds,
        action_name: 'QR_STR_SCENE',
        action_info: {
          scene: {
            scene_str: sceneStr,
          },
        },
      }
    );

    if (response.data.errcode) {
      throw new Error(`生成二维码失败: ${response.data.errmsg}`);
    }

    return {
      ticket: response.data.ticket,
      url: response.data.url,
      expire_seconds: response.data.expire_seconds,
    };
  } catch (err) {
    console.error('[WeChat] 生成二维码失败:', err.message);
    throw err;
  }
}

async function sendTemplateMessage(openid, templateId, data, url = '') {
  const accessToken = await getAccessToken();

  const message = {
    touser: openid,
    template_id: templateId,
    url: url,
    data: data,
  };

  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
      message
    );

    if (response.data.errcode) {
      throw new Error(`发送模板消息失败: ${response.data.errmsg}`);
    }

    console.log('[WeChat] 模板消息已发送, msgid:', response.data.msgid);
    return { msgid: response.data.msgid };
  } catch (err) {
    console.error('[WeChat] 发送模板消息失败:', err.message);
    throw err;
  }
}

async function sendTextMessage(openid, content) {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`,
      {
        touser: openid,
        msgtype: 'text',
        text: {
          content: content,
        },
      }
    );

    if (response.data.errcode) {
      throw new Error(`发送客服消息失败: ${response.data.errmsg}`);
    }

    console.log('[WeChat] 客服消息已发送');
    return { success: true };
  } catch (err) {
    console.error('[WeChat] 发送客服消息失败:', err.message);
    throw err;
  }
}

function verifySignature(signature, timestamp, nonce, token) {
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  return hash === signature;
}

export {
  getAccessToken,
  generateQRCode,
  sendTemplateMessage,
  sendTextMessage,
  verifySignature,
  WECHAT_CONFIG,
};
