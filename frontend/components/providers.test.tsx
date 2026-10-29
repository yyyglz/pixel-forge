import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Providers from './providers';

// Providers hides the site header on the studio route based on usePathname.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const users = [
  { id: 1, username: 'alex', displayName: 'Alex Chen' },
  { id: 2, username: 'sam', displayName: 'Sam Lin' },
];

function accountFor(user: number) {
  return user === 2
    ? { credits: 3200, plan: 'PRO', displayName: 'Sam Lin', username: 'sam' }
    : { credits: 5000, plan: 'FREE', displayName: 'Alex Chen', username: 'alex' };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/demo/users')) return json({ data: users });
      if (url.endsWith('/demo/account')) {
        const headers = new Headers(init?.headers);
        const user = Number(headers.get('X-Demo-User-Id') || '1');
        return json({ data: accountFor(user) });
      }
      throw new Error('Unexpected request: ' + url);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('演示身份与顶部操作', () => {
  it('首次访问自动以演示用户 1 登录并展示额度', async () => {
    render(
      <Providers>
        <p>content</p>
      </Providers>,
    );
    expect(await screen.findByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(await screen.findByText(/5000 额度/)).toBeInTheDocument();
    expect(localStorage.getItem('pixel-user')).toBe('1');
  });

  it('切换语言并持久化', async () => {
    render(
      <Providers>
        <p>content</p>
      </Providers>,
    );
    const language = await screen.findByRole('button', { name: 'English' });
    fireEvent.click(language);
    expect(await screen.findByRole('button', { name: '中文' })).toBeInTheDocument();
    expect(localStorage.getItem('pixel-locale')).toBe('en');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('退出后记住登出状态，并可用另一个演示用户登录', async () => {
    render(
      <Providers>
        <p>content</p>
      </Providers>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '退出登录' }));
    expect(localStorage.getItem('pixel-user')).toBeNull();
    expect(localStorage.getItem('pixel-signed-out')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: /Sam Lin/ }));

    await waitFor(() => expect(localStorage.getItem('pixel-user')).toBe('2'));
    expect(await screen.findByText(/3200 额度/)).toBeInTheDocument();
  });

  it('账户弹窗展示演示资料并进入额度与方案', async () => {
    render(
      <Providers>
        <p>content</p>
      </Providers>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /5000 额度/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('账户设置')).toBeInTheDocument();
    expect(within(dialog).getByText(/alex@pixelforge.demo/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /账户与额度/ }));
    expect(await screen.findByText('可用额度')).toBeInTheDocument();
  });
});
