import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { Task, Message, Agent } from '@openclaw/shared';

// ─── State ───

export interface UIState {
  currentAgentId: string | null;
  currentTaskId: string | null;
  sidebarCollapsed: boolean;
}

export interface AppState {
  agents: Agent[];
  tasks: Task[];
  messagesByTask: Record<string, Message[]>;
  ui: UIState;
}

const initialState: AppState = {
  agents: [],
  tasks: [],
  messagesByTask: {},
  ui: {
    currentAgentId: null,
    currentTaskId: null,
    sidebarCollapsed: false,
  },
};

// ─── Actions ───

type Action =
  | { type: 'SET_AGENTS'; agents: Agent[] }
  | { type: 'ADD_AGENT'; agent: Agent }
  | { type: 'UPDATE_AGENT'; agent: Agent }
  | { type: 'REMOVE_AGENT'; id: string }
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'SET_MESSAGES'; taskId: string; messages: Message[] }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_CURRENT_AGENT'; agentId: string | null }
  | { type: 'SET_CURRENT_TASK'; taskId: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_AGENTS':
      return { ...state, agents: action.agents };

    case 'ADD_AGENT':
      if (state.agents.some((a) => a.id === action.agent.id)) {
        return {
          ...state,
          agents: state.agents.map((a) =>
            a.id === action.agent.id ? action.agent : a,
          ),
        };
      }
      return { ...state, agents: [...state.agents, action.agent] };

    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agent.id ? action.agent : a,
        ),
      };

    case 'REMOVE_AGENT':
      return {
        ...state,
        agents: state.agents.filter((a) => a.id !== action.id),
      };

    case 'SET_TASKS':
      return { ...state, tasks: action.tasks };

    case 'ADD_TASK':
      // Avoid duplicate
      if (state.tasks.some((t) => t.id === action.task.id)) {
        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === action.task.id ? action.task : t,
          ),
        };
      }
      return { ...state, tasks: [action.task, ...state.tasks] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.task.id ? action.task : t,
        ),
      };

    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messagesByTask: {
          ...state.messagesByTask,
          [action.taskId]: action.messages,
        },
      };

    case 'ADD_MESSAGE': {
      const taskId = action.message.taskId;
      const existing = state.messagesByTask[taskId] ?? [];
      // Avoid duplicate
      if (existing.some((m) => m.id === action.message.id)) return state;
      // 真实消息到达时，清除同任务下的乐观消息（tmp_ 前缀）
      const isTmp = action.message.id.startsWith('tmp_');
      const filtered = isTmp
        ? existing
        : existing.filter((m) => !m.id.startsWith('tmp_'));
      return {
        ...state,
        messagesByTask: {
          ...state.messagesByTask,
          [taskId]: [...filtered, action.message],
        },
      };
    }

    case 'SET_CURRENT_AGENT':
      return {
        ...state,
        ui: { ...state.ui, currentAgentId: action.agentId },
      };

    case 'SET_CURRENT_TASK':
      return {
        ...state,
        ui: { ...state.ui, currentTaskId: action.taskId },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed },
      };

    case 'SET_SIDEBAR_COLLAPSED':
      return {
        ...state,
        ui: { ...state.ui, sidebarCollapsed: action.collapsed },
      };

    default:
      return state;
  }
}

// ─── Context ───

const StateCtx = createContext<AppState>(initialState);
const DispatchCtx = createContext<Dispatch<Action>>(() => {});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useAppState() {
  return useContext(StateCtx);
}

export function useDispatch() {
  return useContext(DispatchCtx);
}
