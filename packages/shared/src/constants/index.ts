import type { TaskStatus } from '../types/index.js';

// ─── Task Status Transitions ───

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['pending'], // retry → back to pending
  cancelled: [],
};

// ─── Tool Whitelist ───

export const ALLOWED_TOOLS = [
  'read',
  'write',
  'edit',
  'exec',
  'web_search',
  'web_fetch',
  'browser',
  'message',
] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

// ─── Dangerous Command Patterns ───

export const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  />:\s*\/dev\/null/,
  /dd\s+if=/i,
  /mkfs/i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
  /chmod\s+777/i,
  />\s*\/dev\/sd/i,
];

export const WARNING_PATTERNS = [
  /sudo\s+/i,
  /systemctl\s+/i,
];

// ─── Intent Patterns ───

export interface IntentPattern {
  intent: string;
  keywords: string[];
  tools: string[];
  confidenceBoost: number;
}

export const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'file_operation',
    keywords: ['文件', '读取', '写入', '修改', '创建', '删除文件', '编辑'],
    tools: ['read', 'write', 'edit'],
    confidenceBoost: 0.3,
  },
  {
    intent: 'command_execution',
    keywords: ['执行', '运行', 'shell', '命令', 'git', '安装', '编译', '构建'],
    tools: ['exec'],
    confidenceBoost: 0.3,
  },
  {
    intent: 'web_search',
    keywords: ['搜索', '查询', '查一下', '找找', '查快递', '查天气', '搜一下'],
    tools: ['web_search', 'web_fetch'],
    confidenceBoost: 0.2,
  },
  {
    intent: 'web_browse',
    keywords: ['打开网页', '浏览', '访问', '网站', '链接'],
    tools: ['browser', 'web_fetch'],
    confidenceBoost: 0.2,
  },
  {
    intent: 'general',
    keywords: ['帮我', '请', '能不能', '怎么', '什么'],
    tools: [],
    confidenceBoost: 0.1,
  },
];

// ─── New Task Intent Keywords ───

export const NEW_TASK_KEYWORDS = [
  '另外', '还有', '新任务', '另一件事', '换个', '别的事',
];

// ─── Priorities ───

export const PRIORITY_LABELS: Record<number, string> = {
  0: '紧急',
  1: '普通',
  2: '低',
};
