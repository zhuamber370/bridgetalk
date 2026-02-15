/**
 * 简单的日志工具
 * 根据 NODE_ENV 环境变量控制日志输出
 */

const DEBUG = process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: unknown[]) => {
    if (DEBUG) {
      console.log(...args);
    }
  },

  info: (...args: unknown[]) => {
    console.log(...args);
  },

  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
