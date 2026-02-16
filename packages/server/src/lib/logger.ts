/**
 * Simple logging utility
 * Controls log output based on NODE_ENV environment variable
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
