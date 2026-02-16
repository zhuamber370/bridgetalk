import { useKeyboard, globalKeyBindings } from '../lib/hooks';
import { useDispatch } from '../lib/store';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard bindings component
 * Should be mounted at application root
 */
export function GlobalKeyBindings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useKeyboard([
    // Cmd/Ctrl + /: Toggle sidebar
    globalKeyBindings.toggleSidebar(() => {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }),

    // Cmd/Ctrl + N: New task (navigate to home)
    globalKeyBindings.newTask(() => {
      navigate('/');
    }),

    // Escape: Close modal/go back (not implemented here, handled by individual components)
    // globalKeyBindings.escape(() => {
    //   // Handled internally by components
    // }),
  ]);

  return null;
}
