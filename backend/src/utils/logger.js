/**
 * 统一日志工具 logger
 * 版本: v1.0
 * 说明:
 *  - 封装分级日志：info / warn / error / debug
 *  - 统一输出格式：[ISO时间戳] [环境标识] [级别] [模块名] 消息
 *  - debug 级别默认不输出，设置环境变量 DEBUG_LOG=1 时开启（不影响线上排障）
 *  - 不替换/不删除现有 console 调用，仅作为关键入口的增强日志接入，
 *    避免改变现有日志行为导致排障困难。
 */

// 环境标识：staging / production / development
const ENV = process.env.NODE_ENV || 'development';

function ts() {
  return new Date().toISOString();
}

function fmt(level, module, args) {
  const prefix = `[${ts()}] [${ENV}] [${level.toUpperCase()}] [${module}]`;
  return [prefix, ...args];
}

export const logger = {
  /** info 级别 */
  info(module, ...args) {
    console.log(...fmt('info', module, args));
  },
  /** warn 级别 */
  warn(module, ...args) {
    console.warn(...fmt('warn', module, args));
  },
  /** error 级别 */
  error(module, ...args) {
    console.error(...fmt('error', module, args));
  },
  /** debug 级别（默认关闭，DEBUG_LOG=1 时开启） */
  debug(module, ...args) {
    if (process.env.DEBUG_LOG === '1') {
      console.log(...fmt('debug', module, args));
    }
  },
};

export default logger;
