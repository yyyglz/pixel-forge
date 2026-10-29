import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TaskCard, TaskList } from './task-list';
import type { Task } from '@/lib/api';

const { labels } = vi.hoisted(() => ({
  labels: {
    queued: '等待处理',
    running: '处理中',
    succeeded: '制作完成',
    failed: '制作失败',
    assetCheck: '检查素材',
    generating: '生成画面',
    finalizing: '整理结果',
    queueHint: '任务已受理，等待后台处理。',
    syncError: '状态同步失败，保留上次状态。',
    queryAgain: '重新查询',
    refresh: '刷新',
    copy: '复制链接',
    copied: '已复制',
    openResult: '预览制作结果',
    close: '关闭',
    preview: '预览',
    imageResult: '制作结果',
    refreshButton: '刷新',
    noTasks: '还没有作品',
    noTasksHint: '上传素材，开始第一次创作。',
    loadHistoryFailed: '历史记录加载失败。',
    retry: '重试',
    previous: '上一页',
    next: '下一页',
    page: '第',
    noAccount: '尚未登录',
    authPrompt: '登录后查看你的制作记录',
    signIn: '登录',
  } as Record<string, string>,
}));

vi.mock('./providers', () => ({
  useUser: () => ({
    user: 1,
    locale: 'zh',
    isSignedIn: true,
    users: [],
    openLogin: () => {},
    openAccount: () => {},
    changeUser: () => {},
    setLocale: () => {},
    t: (key: string) => labels[key] ?? key,
  }),
}));

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const task = (id: string, status: Task['status'], overrides: Partial<Task> = {}): Task => ({
  id,
  templateId: 1,
  templateTitle: `模板 ${id}`,
  status,
  currentStage: null,
  failedStage: null,
  errorMessage: null,
  resultUrl: null,
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
  ...overrides,
});

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('TaskCard 异步状态', () => {
  it('查询异常时保留最后一次业务状态，不显示成失败', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    renderWithClient(<TaskCard initial={task('a', 'RUNNING', { currentStage: 'GENERATING' })} />);

    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getByText('生成画面')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/状态同步失败/)).toBeInTheDocument());

    // The last known business state is preserved; a sync error is not a task failure.
    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.queryByText('制作失败')).not.toBeInTheDocument();
  });

  it('多个任务互不串扰：一个失败不影响另一个的处理状态', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    renderWithClient(
      <>
        <TaskCard
          initial={task('a', 'FAILED', { failedStage: 'FINALIZING', errorMessage: '素材检查失败' })}
        />
        <TaskCard initial={task('b', 'RUNNING', { currentStage: 'GENERATING' })} />
      </>,
    );

    expect(screen.getByText('制作失败')).toBeInTheDocument();
    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getAllByText(/整理结果/)).toHaveLength(1);

    await waitFor(() => expect(screen.getAllByText(/状态同步失败/)).toHaveLength(2));
    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getByText('制作失败')).toBeInTheDocument();
  });

  it('终态不会被轮询返回的旧数据回退', async () => {
    const staleRunning = task('a', 'RUNNING', { currentStage: 'GENERATING' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(staleRunning));
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient(
      <TaskCard initial={task('a', 'SUCCEEDED', { resultUrl: '/api/media/results/a.png?userId=1' })} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: '预览制作结果' })).toBeInTheDocument();
    expect(screen.queryByText('处理中')).not.toBeInTheDocument();
  });

  it('成功任务在当前页弹窗预览结果，不打开新窗口', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    renderWithClient(
      <TaskCard initial={task('b', 'SUCCEEDED', { resultUrl: '/api/media/results/b.png?userId=1' })} />,
    );

    expect(screen.queryByRole('link', { name: '预览制作结果' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预览制作结果' }));

    const dialog = screen.getByRole('dialog', { name: '制作结果' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/api/media/results/b.png?userId=1');

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('复制按钮写入剪贴板并提示已复制', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithClient(
      <TaskCard initial={task('c', 'FAILED', { failedStage: 'GENERATING', errorMessage: '任务失败' })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '复制链接' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('c'));
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('full 变体显示模板标题、创建时间与状态文字', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    renderWithClient(
      <TaskCard
        initial={task('d', 'SUCCEEDED', {
          templateTitle: '柔光人像',
          resultUrl: '/api/media/results/d.png?userId=1',
        })}
        variant="full"
      />,
    );

    expect(screen.getByText('柔光人像')).toBeInTheDocument();
    expect(screen.getByText('制作完成')).toBeInTheDocument();
  });
});

describe('TaskList', () => {
  it('加载失败显示错误与重试入口，而不是空状态', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络错误')));
    renderWithClient(<TaskList variant="full" />);

    expect(await screen.findByText('历史记录加载失败。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByText('还没有作品')).not.toBeInTheDocument();
  });

  it('空列表显示空状态', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
    renderWithClient(<TaskList variant="panel" />);

    expect(await screen.findByText('还没有作品')).toBeInTheDocument();
    expect(screen.getByText('上传素材，开始第一次创作。')).toBeInTheDocument();
  });

  it('panel 变体按 templateId 过滤当前模板的创作记录', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/tasks?')) return jsonResponse([]);
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithClient(<TaskList variant="panel" templateId={7} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('templateId=7')),
    ).toBe(true);
    expect(await screen.findByText('还没有作品')).toBeInTheDocument();
  });

  it('full 变体渲染任务卡片并保留分页控件', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/tasks?')) {
          return jsonResponse([
            task('a', 'FAILED', { failedStage: 'GENERATING', errorMessage: '任务失败' }),
            task('b', 'QUEUED'),
          ]);
        }
        return jsonResponse(task(url.includes('/tasks/a') ? 'a' : 'b', 'FAILED', { failedStage: 'GENERATING', errorMessage: '任务失败' }));
      }),
    );

    renderWithClient(<TaskList variant="full" />);

    expect(await screen.findByText('模板 a')).toBeInTheDocument();
    expect(screen.getByText('模板 b')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(screen.getByText('第 1')).toBeInTheDocument();
  });
});
