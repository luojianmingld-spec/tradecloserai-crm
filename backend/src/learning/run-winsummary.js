/**
 * 话术库自主学习进化 V1 - 成交总结引擎主入口（独立进程）
 * 用法: node src/learning/run-winsummary.js [--accountId=1] [--limit=20]
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { runWinSummary } from './win-summary.js';

function parseArgs(argv) {
  const opts = { accountId: CFG.defaultAccountId, limit: 20 };
  for (const a of argv) {
    if (a.startsWith('--accountId=')) opts.accountId = parseInt(a.split('=')[1], 10) || CFG.defaultAccountId;
    else if (a.startsWith('--limit=')) opts.limit = parseInt(a.split('=')[1], 10) || 20;
  }
  return opts;
}

const isMain = process.argv[1] && /run-winsummary\.js$/.test(process.argv[1]);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  runWinSummary(opts)
    .then((r) => {
      console.log('[WinSummary Run Result]', JSON.stringify(r));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[WinSummary Run Failed]', e.message);
      process.exit(1);
    });
}

export default { runWinSummary };
