import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { Task, Message } from '@openclaw/shared';

// ─── State ───

export interface AppState {
  tasks: Task[];
  messagesByTask: Record<string, Message[]>;
}

const initialState: AppState = {
  tasks: [],
  messagesByTask: {},
};

// ─── Actions ───

type Action =
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'SET_MESSAGES'; taskId: string; messages: Message[] }
  | { type: 'ADD_MESSAGE'; message: Message };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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
      return {
        ...state,
        messagesByTask: {
          ...state.messagesByTask,
          [taskId]: [...existing, action.message],
        },
      };
    }

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
