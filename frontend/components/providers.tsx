'use client';

import Link from 'next/link';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  ChevronRight,
  CreditCard,
  FileLock,
  FileText,
  Languages,
  LogOut,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { api, User } from '@/lib/api';
import { Locale, MessageKey, messages } from '@/lib/i18n';

type Account = { credits: number; plan: 'FREE' | 'PRO'; displayName: string; username: string };
type ModalName = 'login' | 'account' | 'billing' | 'terms' | 'privacy' | null;

type UserContextValue = {
  user: number;
  isSignedIn: boolean;
  users: User[];
  locale: Locale;
  openLogin: () => void;
  openAccount: () => void;
  changeUser: (id: number) => void;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const UserContext = createContext<UserContextValue>({
  user: 1,
  isSignedIn: false,
  users: [],
  locale: 'zh',
  openLogin: () => {},
  openAccount: () => {},
  changeUser: () => {},
  setLocale: () => {},
  t: (key) => messages.zh[key],
});

export const useUser = () => useContext(UserContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Shell>{children}</Shell>
    </QueryClientProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState(1);
  const [isSignedIn, setSignedIn] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [modal, setModal] = useState<ModalName>(null);
  const [showResetNote, setShowResetNote] = useState(false);


  useEffect(() => {
    let mounted = true;
    const savedUser = Number(localStorage.getItem('pixel-user'));
    const signedOut = localStorage.getItem('pixel-signed-out') === '1';
    const savedLocale = localStorage.getItem('pixel-locale');
    queueMicrotask(() => {
      if (!mounted) return;
      if (savedUser === 1 || savedUser === 2) {
        setUser(savedUser);
        setSignedIn(true);
      } else if (!signedOut) {
        // First visit: start as the first demo user so the site can be explored
        // end to end without a separate sign-in step. Logout is remembered.
        localStorage.setItem('pixel-user', '1');
        setUser(1);
        setSignedIn(true);
      }
      if (savedLocale === 'zh' || savedLocale === 'en') {
        setLocaleState(savedLocale);
        document.documentElement.lang = savedLocale === 'zh' ? 'zh-CN' : 'en';
      }
    });
    api<User[]>('/demo/users')
      .then((value) => {
        if (mounted) setUsers(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  function openModal(name: Exclude<ModalName, null>) {
    setShowResetNote(false);
    setModal(name);
  }

  function changeUser(id: number) {
    void client.cancelQueries();
    client.clear();
    localStorage.setItem('pixel-user', String(id));
    localStorage.removeItem('pixel-signed-out');
    setUser(id);
    setSignedIn(true);
    setModal(null);
  }

  function logOut() {
    void client.cancelQueries();
    client.clear();
    localStorage.removeItem('pixel-user');
    localStorage.setItem('pixel-signed-out', '1');
    setSignedIn(false);
    setModal(null);
  }

  function setLocale(value: Locale) {
    localStorage.setItem('pixel-locale', value);
    setLocaleState(value);
    document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en';
  }

  const t = (key: MessageKey): string => messages[locale][key];

  const account = useQuery({
    queryKey: ['demo-account', user],
    queryFn: ({ signal }) => api<Account>('/demo/account', { signal }, user),
    enabled: isSignedIn,
  });

  const updateAccount = useMutation({
    mutationFn: ({ action, plan }: { action: 'plan' | 'credits'; plan?: 'FREE' | 'PRO' }) =>
      api<Account>(
        `/demo/account/${action}`,
        {
          method: 'POST',
          ...(action === 'plan'
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) }
            : {}),
        },
        user,
      ),
    onSuccess: (data) => client.setQueryData(['demo-account', user], data),
  });

  const selected = users.find((u) => u.id === user);
  const username = selected?.username ?? account.data?.username ?? 'demo';
  const displayName = selected?.displayName ?? account.data?.displayName ?? t('demoUser');
  const planLabel = account.data?.plan === 'PRO' ? t('planPro') : t('planFree');

  const modalTitle =
    modal === 'login'
      ? t('signInTitle')
      : modal === 'account'
        ? t('accountTitle')
        : modal === 'billing'
          ? t('manageBilling')
          : modal === 'terms'
            ? t('terms')
            : t('privacy');

  return (
    <UserContext.Provider
      value={{
        user,
        isSignedIn,
        users,
        locale,
        openLogin: () => openModal('login'),
        openAccount: () => openModal('account'),
        changeUser,
        setLocale,
        t,
      }}
    >
      <header className="topbar">
        <Link href="/" className="brand" aria-label="PixelForge">
          <LogoMark />
        </Link>
        <div className="top-actions">
          <button
            type="button"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            aria-label={t('language')}
          >
            <Languages size={15} aria-hidden="true" />
            {t('language')}
          </button>
          {isSignedIn ? (
            <>
              <button
                type="button"
                className="credits-trigger"
                data-ui="account"
                onClick={() => openModal('account')}
              >
                {account.data ? (
                  <>
                    {planLabel} {account.data.credits} {t('creditsUnit')}
                  </>
                ) : account.isError ? (
                  t('accountError')
                ) : (
                  '…'
                )}
              </button>
              <button type="button" className="logout" onClick={logOut}>
                {t('signOut')}
              </button>
            </>
          ) : (
            <button type="button" className="login-btn" data-ui="login" onClick={() => openModal('login')}>
              {t('signIn')}
            </button>
          )}
        </div>
      </header>
      <main key={`${user}-${isSignedIn}`}>{children}</main>

      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header className="modal-head">
              <h2 id="modal-title">{modalTitle}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label={t('close')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {modal === 'login' && (
              <>
                <p className="modal-note">{t('loginHint')}</p>
                <div className="login-list">
                  {users.length ? (
                    users.map((u) => (
                      <button
                        type="button"
                        className="login-row"
                        key={u.id}
                        onClick={() => changeUser(u.id)}
                      >
                        <span className="avatar sm">
                          <UserRound size={22} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{u.displayName}</strong>
                          <small>
                            @{u.username} · {t('demoUser')}
                          </small>
                        </span>
                        <span className="go">{t('loginAction')}</span>
                      </button>
                    ))
                  ) : (
                    <p className="modal-note">{t('loadFailed')}</p>
                  )}
                </div>
              </>
            )}

            {modal === 'account' && (
              <>
                <div className="account-card">
                  <div className="account-profile">
                    <span className="avatar">
                      <UserRound size={28} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{displayName}</h3>
                      <p>
                        @{username} · {t('demoUser')}
                      </p>
                    </div>
                  </div>
                  <div className="account-divider" />
                  <div className="account-field-block">
                    <span className="label">{t('email')}</span>
                    <span className="value">{username}@pixelforge.demo</span>
                  </div>
                  <div className="account-field-block">
                    <span className="label">{t('password')}</span>
                    <div className="password-row">
                      <span className="password-dots" aria-hidden="true">
                        {Array.from({ length: 10 }, (_, index) => (
                          <i key={index} />
                        ))}
                      </span>
                      <button type="button" className="reset-btn" onClick={() => setShowResetNote(true)}>
                        {t('reset')}
                      </button>
                    </div>
                  </div>
                  {showResetNote && (
                    <p className="field-note" role="status">
                      {t('resetNote')}
                    </p>
                  )}
                </div>

                <div className="account-links">
                  <button type="button" className="account-link" onClick={() => openModal('billing')}>
                    <CreditCard size={20} aria-hidden="true" />
                    {t('manageBilling')}
                    <ChevronRight className="chevron" size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="account-link" onClick={() => openModal('login')}>
                    <Users size={20} aria-hidden="true" />
                    {t('switchUser')}
                    <ChevronRight className="chevron" size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="account-link" onClick={() => openModal('terms')}>
                    <FileText size={20} aria-hidden="true" />
                    {t('terms')}
                    <ChevronRight className="chevron" size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="account-link" onClick={() => openModal('privacy')}>
                    <FileLock size={20} aria-hidden="true" />
                    {t('privacy')}
                    <ChevronRight className="chevron" size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="account-foot">
                  <div className="account-foot-head">
                    <button type="button" className="account-foot-title" onClick={logOut}>
                      {t('signOut')}
                    </button>
                    <button
                      type="button"
                      className="account-foot-icon"
                      onClick={logOut}
                      aria-label={t('signOut')}
                    >
                      <LogOut size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <p>{t('signOutHint')}</p>
                </div>
              </>
            )}

            {modal === 'billing' && (
              <>
                <p className="modal-note">{t('billingNotice')}</p>
                {account.isError ? (
                  <div className="modal-error">
                    {t('accountError')}{' '}
                    <button type="button" onClick={() => account.refetch()}>
                      {t('retry')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="credit-box">
                      <span>{t('creditsAvailable')}</span>
                      <strong>{account.data?.credits ?? '…'}</strong>
                      <small>{t('creditsExplain')}</small>
                    </div>
                    <div className="plan-grid">
                      {(['FREE', 'PRO'] as const).map((plan) => (
                        <div
                          key={plan}
                          className={'plan-card' + (account.data?.plan === plan ? ' active' : '')}
                        >
                          <h4>{plan === 'FREE' ? t('freePlan') : t('proPlan')}</h4>
                          <p>{t('demoOnly')}</p>
                          <button
                            type="button"
                            disabled={!account.data || account.data.plan === plan || updateAccount.isPending}
                            onClick={() => updateAccount.mutate({ action: 'plan', plan })}
                          >
                            {account.data?.plan === plan ? t('current') : t('choosePlan')}
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="credits-add"
                      disabled={!account.data || updateAccount.isPending}
                      onClick={() => updateAccount.mutate({ action: 'credits' })}
                    >
                      {t('addCredits')}
                    </button>
                    {updateAccount.isError && (
                      <p className="modal-error" role="alert">
                        {t('operationError')}
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            {(modal === 'terms' || modal === 'privacy') && (
              <div className="info-dialog">
                <p>{modal === 'terms' ? t('termsBody') : t('privacyBody')}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </UserContext.Provider>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 30 30" aria-hidden="true">
      <defs>
        <linearGradient id="pf-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaff55" />
          <stop offset="1" stopColor="#c6f200" />
        </linearGradient>
      </defs>
      <rect width="30" height="30" rx="8" fill="url(#pf-logo-bg)" />
      <path
        d="M15.4 21.6c-3.5 0-5.9-2.1-5.9-5.1 0-2.6 1.9-4.5 4.5-4.8.7-2.3 2.7-3.9 5.3-3.9 3.1 0 5.3 2.1 5.5 5.2 1.9.6 3.2 2.1 3.2 4.1 0 2.7-2.2 4.5-5.2 4.5h-7.4z"
        fill="#6c5ce7"
      />
      <rect x="14.3" y="13.2" width="1.8" height="3.9" rx="0.9" fill="#dcd9ff" />
      <rect x="18.5" y="13.2" width="1.8" height="3.9" rx="0.9" fill="#dcd9ff" />
    </svg>
  );
}
