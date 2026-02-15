import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface OpenClawAgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string;
  subagents?: { allowAgents?: string[] };
}

export interface OpenClawModelInfo {
  id: string;        // 如 'openai-codex/gpt-5.2'
  alias?: string;    // 如 'plus'
  isDefault?: boolean;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string };
      models?: Record<string, { alias?: string }>;
      workspace?: string;
    };
    list?: OpenClawAgentConfig[];
  };
  tools?: {
    agentToAgent?: { enabled?: boolean; allow?: string[] };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME || join(homedir(), '.openclaw');
}

function getConfigPath(): string {
  return join(getOpenClawHome(), 'openclaw.json');
}

export function readConfig(): OpenClawConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function writeConfig(config: OpenClawConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + '\n');
}

/** 列出主 agent 可见的 agents（main 自身 + allowAgents 白名单） */
export function listConfiguredAgents(): OpenClawAgentConfig[] {
  const config = readConfig();
  const list = config.agents?.list ?? [];

  // 找到 main agent 的 allowAgents 白名单
  const mainAgent = list.find((a) => a.id === 'main' || a.default);
  const allowedIds = new Set(mainAgent?.subagents?.allowAgents ?? []);
  // main 自身也是可用 agent
  allowedIds.add('main');

  return list.filter((a) => allowedIds.has(a.id));
}

/** 列出 openclaw.json 中可用的模型 */
export function listAvailableModels(): OpenClawModelInfo[] {
  const config = readConfig();
  const defaults = config.agents?.defaults;
  if (!defaults?.models) return [];

  const primaryModel = defaults.model?.primary;
  return Object.entries(defaults.models).map(([id, info]) => ({
    id,
    alias: info.alias,
    isDefault: id === primaryModel,
  }));
}

/** 注册新 agent 到 openclaw.json，创建必要目录 */
export function registerAgent(id: string, name: string, model?: string): void {
  const home = getOpenClawHome();
  const config = readConfig();

  // 确保 agents.list 存在
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // 已存在则跳过
  if (config.agents.list.some((a) => a.id === id)) return;

  // 使用指定模型，否则回退到默认模型
  const agentModel = model || config.agents.defaults?.model?.primary;

  // 构造路径
  const workspace = join(home, `workspace-${id}`);
  const agentDir = join(home, 'agents', id, 'agent');

  // 添加到 agents.list
  config.agents.list.push({
    id,
    name,
    workspace,
    agentDir,
    ...(agentModel ? { model: agentModel } : {}),
  });

  // 添加到 tools.agentToAgent.allow
  if (!config.tools) config.tools = {};
  if (!config.tools.agentToAgent) config.tools.agentToAgent = { enabled: true };
  if (!config.tools.agentToAgent.allow) config.tools.agentToAgent.allow = [];
  if (!config.tools.agentToAgent.allow.includes(id)) {
    config.tools.agentToAgent.allow.push(id);
  }

  // 添加到 main 的 subagents.allowAgents
  const mainAgent = config.agents.list.find((a) => a.id === 'main' || a.default);
  if (mainAgent) {
    if (!mainAgent.subagents) mainAgent.subagents = {};
    if (!mainAgent.subagents.allowAgents) mainAgent.subagents.allowAgents = [];
    if (!mainAgent.subagents.allowAgents.includes(id)) {
      mainAgent.subagents.allowAgents.push(id);
    }
  }

  // 写回配置
  writeConfig(config);

  // 创建目录
  mkdirSync(workspace, { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(join(home, 'agents', id, 'sessions'), { recursive: true });
}
