import { ALLOWED_TOOLS, DANGEROUS_PATTERNS, WARNING_PATTERNS } from '@openclaw/shared';
import type { ValidationResult, ConfirmationCheck } from '@openclaw/shared';

export function validateTool(tool: string): ValidationResult {
  if ((ALLOWED_TOOLS as readonly string[]).includes(tool)) {
    return { valid: true };
  }
  return { valid: false, reason: `工具 "${tool}" 不在白名单中` };
}

export function checkDangerousCommand(command: string): ConfirmationCheck {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        requiresConfirmation: true,
        level: 'danger',
        reason: '检测到高危操作',
        detail: `命令匹配危险模式: ${pattern.source}`,
      };
    }
  }

  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(command)) {
      return {
        requiresConfirmation: true,
        level: 'warning',
        reason: '需要系统级权限',
        detail: '该命令可能影响系统运行',
      };
    }
  }

  return { requiresConfirmation: false };
}
