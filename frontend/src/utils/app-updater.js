/**
 * In-app update for Capacitor Android
 * Uses WebView JavaScript Interface (AndroidDownload) for reliable native calls
 */
import { App } from '@capacitor/app';

let _hasChecked = false;

function isNativeApp() {
  try {
    return typeof window !== 'undefined'
      && window.Capacitor
      && window.Capacitor.getPlatform
      && window.Capacitor.getPlatform() !== 'web';
  } catch (e) { return false; }
}

// 返回当前环境的后端 base（与 api.js/main.js 保持一致）
function getPlatformBase() {
  return (window.__API_BASE__ && window.__API_BASE__.length > 0)
    ? window.__API_BASE__
    : 'http://45.76.223.251:3002';
}

export async function checkForUpdate(manual = false) {
  if (!isNativeApp()) {
    if (manual) alert('此功能仅在APP中可用');
    return null;
  }
  if (_hasChecked && !manual) return null;
  _hasChecked = true;

  try {
    const res = await fetch(getPlatformBase() + '/api/app-update/version');
    if (!res.ok) {
      if (manual) alert('无法获取版本信息');
      return null;
    }

    const server = await res.json();
    if (!server || !server.version) return null;

    let appVersion = '0.0.0';
    let appBuild = 0;
    try {
      const info = await App.getInfo();
      appVersion = info.version || '0.0.0';
      appBuild = parseInt(info.build) || 0;
    } catch (e) {
      console.warn('[AppUpdater] Failed to get app info:', e);
    }

    const serverBuild = server.versionCode || 0;
    console.log('[AppUpdater] Current: v' + appVersion + ' (build ' + appBuild + '), Server: v' + server.version + ' (build ' + serverBuild + ')');

    if (serverBuild > appBuild) {
      const changelog = server.changelog || '发现新版本，建议更新';
      const msg = '发现新版本 v' + server.version + '\n\n更新内容：\n' + changelog + '\n\n是否立即更新？';

      if (window.confirm(msg)) {
        await downloadAndInstall(server);
      }
      return server;
    } else if (manual) {
      alert('当前已是最新版本 v' + appVersion);
    }
  } catch (e) {
    console.error('[AppUpdater] Error:', e);
    if (manual) alert('检查更新失败：' + e.message);
  }
  return null;
}

async function downloadAndInstall(serverVersion) {
  const apkUrl = getPlatformBase() + serverVersion.apkUrl;
  const filename = 'TradeCloser-v' + serverVersion.version + '.apk';

  alert('开始下载新版本，请稍候……');

  // Try WebView JS Interface (most reliable)
  if (window.AndroidDownload && typeof window.AndroidDownload.downloadAndInstall === 'function') {
    console.log('[AppUpdater] Using AndroidDownload JS interface');
    try {
      // JS Interface calls are synchronous, but download runs on native thread
      const result = window.AndroidDownload.downloadAndInstall(apkUrl, filename);
      console.log('[AppUpdater] Result:', result);
      if (result && result.startsWith('ERROR:')) {
        if (result.indexOf('NEED_PERMISSION') !== -1) {
          alert('需要先允许安装未知来源应用。请在跳转的设置页面中，开启本应用的"允许安装未知应用"开关，然后重新触发更新（设置→应用→本应用→安装未知应用）。');
        } else {
          alert('更新失败：' + result.substring(6));
        }
      }
      return;
    } catch (e) {
      console.error('[AppUpdater] JS Interface error:', e);
    }
  }

  // Fallback: Capacitor nativePromise
  if (window.Capacitor && window.Capacitor.nativePromise) {
    console.log('[AppUpdater] Trying Capacitor nativePromise...');
    try {
      const result = await window.Capacitor.nativePromise('DownloadInstall', 'downloadAndInstall', {
        url: apkUrl,
        filename: filename,
      });
      console.log('[AppUpdater] Native install triggered:', result);
      return;
    } catch (e) {
      console.error('[AppUpdater] nativePromise error:', e);
    }
  }

  // Last fallback: open in browser so the system can handle it
  console.warn('[AppUpdater] All native methods failed, opening in browser');
  try {
    window.open(apkUrl, '_system');
  } catch (e) {
    try {
      window.location.href = apkUrl;
    } catch (e2) {
      alert('下载失败，请手动打开链接：\n' + apkUrl);
    }
  }
}

export function resetCheckFlag() {
  _hasChecked = false;
}
