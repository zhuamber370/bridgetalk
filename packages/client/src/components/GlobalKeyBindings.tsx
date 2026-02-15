import { useKeyboard, globalKeyBindings } from '../lib/hooks';
import { useDispatch } from '../lib/store';
import { useNavigate } from 'react-router-dom';

/**
 * 全局快捷键绑定组件
 * 应在应用根部挂载
 */
export function GlobalKeyBindings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useKeyboard([
    // Cmd/Ctrl + /: 切换侧边栏
    globalKeyBindings.toggleSidebar(() => {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }),

    // Cmd/Ctrl + N: 新建任务（跳转到首页）
    globalKeyBindings.newTask(() => {
      navigate('/');
    }),

    // Escape: 关闭模态框/返回（这里暂时不实现，由各组件自己处理）
    // globalKeyBindings.escape(() => {
    //   // 各组件内部处理
    // }),
  ]);

  return null;
}
