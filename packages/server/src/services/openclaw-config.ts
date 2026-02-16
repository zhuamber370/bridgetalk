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
  id: string;        // e.g., 'openai-codex/gpt-5.2'
  alias?: string;    // e.g., 'plus'
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

/** List agents visible to main agent (main itself + allowAgents whitelist) */
export function listConfiguredAgents(): OpenClawAgentConfig[] {
  const config = readConfig();
  const list = config.agents?.list ?? [];

  // Find main agent's allowAgents whitelist
  const mainAgent = list.find((a) => a.id === 'main' || a.default);
  const allowedIds = new Set(mainAgent?.subagents?.allowAgents ?? []);
  // main itself is also an available agent
  allowedIds.add('main');

  return list.filter((a) => allowedIds.has(a.id));
}

/** List available models in openclaw.json */
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

/** Register new agent to openclaw.json, create necessary directories */
export function registerAgent(id: string, name: string, model?: string): void {
  const home = getOpenClawHome();
  const config = readConfig();

  // Ensure agents.list exists
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Skip if already exists
  if (config.agents.list.some((a) => a.id === id)) return;

  // Use specified model, otherwise fall back to default model
  const agentModel = model || config.agents.defaults?.model?.primary;

  // Construct paths
  const workspace = join(home, `workspace-${id}`);
  const agentDir = join(home, 'agents', id, 'agent');

  // Add to agents.list
  config.agents.list.push({
    id,
    name,
    workspace,
    agentDir,
    ...(agentModel ? { model: agentModel } : {}),
  });

  // Add to tools.agentToAgent.allow
  if (!config.tools) config.tools = {};
  if (!config.tools.agentToAgent) config.tools.agentToAgent = { enabled: true };
  if (!config.tools.agentToAgent.allow) config.tools.agentToAgent.allow = [];
  if (!config.tools.agentToAgent.allow.includes(id)) {
    config.tools.agentToAgent.allow.push(id);
  }

  // Add to main's subagents.allowAgents
  const mainAgent = config.agents.list.find((a) => a.id === 'main' || a.default);
  if (mainAgent) {
    if (!mainAgent.subagents) mainAgent.subagents = {};
    if (!mainAgent.subagents.allowAgents) mainAgent.subagents.allowAgents = [];
    if (!mainAgent.subagents.allowAgents.includes(id)) {
      mainAgent.subagents.allowAgents.push(id);
    }
  }

  // Write back config
  writeConfig(config);

  // Create directories
  mkdirSync(workspace, { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(join(home, 'agents', id, 'sessions'), { recursive: true });
}
