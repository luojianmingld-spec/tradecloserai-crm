/**
 * 话术库自主学习进化 V1 - 学习管道主入口（样本采集 → 学习引擎 → 自动入库）
 * 用法:
 *   node src/learning/run-learning.js --accountId=1 [--limit=120] [--force]
 *  - 独立进程运行，不阻塞在线消息/生成链路
 *  - 增量游标断点续跑（上次 done 任务的 cursor 起）
 */
import { LEARNING_CONFIG as CFG } from './config.js';
import { prisma, log, sessionsForAccount } from './learning.service.js';
import { collectSamples } from './sample-collector.js';
import { analyzeSamples } from './learning-engine.js';
import { importSamples } from './auto-import.js';

function parseArgs(argv) {
  const opts = { accountId: CFG.defaultAccountId, limit: CFG.maxSamplesPerRun, force: false };
  for (const a of argv) {
    if (a.startsWith('--accountId=')) opts.accountId = parseInt(a.split('=')[1], 10) || CFG.defaultAccountId;
    else if (a.startsWith('--limit=')) opts.limit = parseInt(a.split('=')[1], 10) || CFG.maxSamplesPerRun;
    else if (a === '--force') opts.force = true;
  }
  return opts;
}

/**
 * 执行一轮学习管道
 * @returns {Promise<object>} 统计结果
 */
export async function runLearningLoop({ accountId = CFG.defaultAccountId, limit = CFG.maxSamplesPerRun, force = false } = {}) {
  const started = new Date();
  const job = await prisma.learningJob.create({
    data: { accountId, status: 'running', type: 'sample', processed: 0 },
  });
  log('Run', `job#${job.id} 开始学习 accountId=${accountId} limit=${limit} force=${force}`);

  try {
    // 增量游标：取该租户最近一次 done 任务的 cursor
    let cursor = null;
    if (!force) {
      const last = await prisma.learningJob.findFirst({
        where: { accountId, type: 'sample', status: 'done' },
        orderBy: { finished: 'desc' },
        select: { cursor: true },
      });
      cursor = last?.cursor || null;
    }

    const sessionIds = await sessionsForAccount(accountId).catch((e) => { log('WARN', 'sessionsForAccount error:', e.message); return []; });
    const { samples, cursor: newCursor } = await collectSamples({ accountId, sessionIds, cursor, limit });
    log('Run', `job#${job.id} 采集到 ${samples.length} 条配对样本`);

    if (!samples.length) {
      const doneJob = await prisma.learningJob.update({
        where: { id: job.id },
        data: { status: 'done', processed: 0, total: 0, imported: 0, cursor: newCursor || cursor, message: '无新增样本', finished: new Date() },
      });
      return { jobId: doneJob.id, samples: 0, imported: 0, skipped: 0, message: '无新增样本' };
    }

    // 学习引擎（分类+评分+脱敏），LLM 调用
    const results = await analyzeSamples(samples);
    log('Run', `job#${job.id} 完成 ${results.length} 条评估`);

    // 自动入库
    const { imported, skipped } = await importSamples(results);

    const finished = new Date();
    const doneJob = await prisma.learningJob.update({
      where: { id: job.id },
      data: {
        status: 'done',
        processed: results.length,
        total: samples.length,
        imported,
        cursor: newCursor || cursor,
        message: `采集${samples.length} 评估${results.length} 入库${imported} 跳过${skipped}`,
        finished,
      },
    });
    log('Run', `job#${doneJob.id} 完成: 采集=${samples.length} 评估=${results.length} 入库=${imported} 跳过=${skipped} 耗时=${((finished - started) / 1000).toFixed(1)}s`);
    return { jobId: doneJob.id, samples: samples.length, evaluated: results.length, imported, skipped, cursor: doneJob.cursor };
  } catch (e) {
    log('Run', `job#${job.id} 失败:`, e.stack || e.message);
    await prisma.learningJob.update({
      where: { id: job.id },
      data: { status: 'failed', message: String(e.message || e).slice(0, 500), finished: new Date() },
    });
    throw e;
  }
}

// CLI 入口
const isMain = process.argv[1] && /run-learning\.js$/.test(process.argv[1]);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  runLearningLoop(opts)
    .then((r) => {
      console.log('[Learning Run Result]', JSON.stringify(r));
      process.exit(0);
    })
    .catch((e) => {
      console.error('[Learning Run Failed]', e.message);
      process.exit(1);
    });
}

export default { runLearningLoop };
