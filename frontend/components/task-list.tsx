'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, ImageIcon, RefreshCw } from 'lucide-react';
import { api, active, Task } from '@/lib/api';
import { localizeError, MessageKey, templateCopy } from '@/lib/i18n';
import { useUser } from './providers';
import { ImagePreview } from './image-preview';
import styles from './task-list.module.css';

/** Localised label for a task status / pipeline stage identifier. */
const stageKeys: Record<string, MessageKey> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  ASSET_CHECK: 'assetCheck',
  GENERATING: 'generating',
  FINALIZING: 'finalizing',
};

type Translate = (key: MessageKey) => string;

function stageLabel(stage: string | null, t: Translate): string {
  if (!stage) return '';
  return stageKeys[stage] ? t(stageKeys[stage]) : stage;
}

/**
 * Copy through the async Clipboard API when it is available and fall back to a
 * temporary textarea + execCommand for older browsers / non-secure contexts.
 */
async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission denied or unsupported clipboard — fall through to the fallback.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function TaskCard({
  initial,
  variant = 'panel',
}: {
  initial: Task;
  variant?: 'panel' | 'full';
}) {
  const { user, t, locale } = useUser();
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Every card owns its own poll so one task can never influence another one.
  // The query key contains the demo user, which isolates users on top of the
  // QueryClient reset that the shell performs when switching accounts.
  const query = useQuery({
    queryKey: ['task', user, initial.id],
    queryFn: ({ signal }) => api<Task>(`/tasks/${initial.id}`, { signal }, user),
    initialData: initial,
    // Only tasks that are still in flight poll; terminal tasks stop for good.
    refetchInterval: (current) => {
      const snapshot = current.state.data;
      return snapshot && active(snapshot) ? 2000 : false;
    },
    // Never let a late/stale poll roll a finished task back to QUEUED/RUNNING.
    structuralSharing: (oldData, newData) => {
      const previous = oldData as Task | undefined;
      const next = newData as Task;
      return previous && !active(previous) && active(next) ? previous : next;
    },
  });

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const task = query.data;
  const running = active(task);
  const statusText = stageLabel(task.status, t);
  const stageText = stageLabel(
    task.status === 'FAILED' ? task.failedStage : task.currentStage,
    t,
  );
  const failure =
    task.status === 'FAILED'
      ? [stageText, task.errorMessage ? localizeError(task.errorMessage, locale) : '']
          .filter(Boolean)
          .join(' · ')
      : '';
  const resultUrl = task.status === 'SUCCEEDED' ? task.resultUrl : null;
  const templateTitle = templateCopy(
    { id: task.templateId, title: task.templateTitle, description: '' },
    locale,
  ).title;

  function showCopied() {
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  async function copyLink() {
    // A finished task is most useful to share through its result URL.
    const value = resultUrl ? new URL(resultUrl, window.location.origin).href : task.id;
    if (await writeClipboard(value)) showCopied();
  }

  const statusClass =
    task.status === 'SUCCEEDED'
      ? styles.statusSucceeded
      : task.status === 'FAILED'
        ? styles.statusFailed
        : styles.statusActive;

  return (
    <article
      className={`${styles.card} ${variant === 'full' ? styles.full : styles.panel}`}
      data-task-id={task.id}
      data-status={task.status}
    >
      {resultUrl ? (
        <button
          type="button"
          className={styles.resultLink}
          onClick={() => setPreviewOpen(true)}
          aria-label={t('openResult')}
        >
          <img className={styles.resultImage} src={resultUrl} alt={t('imageResult')} />
        </button>
      ) : (
        <div className={styles.center}>
          <strong className={styles.status}>
            {statusText}
            {task.status === 'RUNNING' && (
              <span className={styles.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
          </strong>
          {task.status === 'QUEUED' && <span className={styles.detail}>{t('queueHint')}</span>}
          {task.status === 'RUNNING' && stageText && (
            <span className={styles.detail}>{stageText}</span>
          )}
          {task.status === 'FAILED' && failure && <span className={styles.detail}>{failure}</span>}
        </div>
      )}

      {variant === 'full' && (
        <div className={styles.info}>
          <strong className={styles.infoTitle}>{templateTitle}</strong>
          <div className={styles.infoMeta}>
            <time dateTime={task.createdAt}>
              {new Date(task.createdAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
            </time>
            <span className={statusClass}>{statusText}</span>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {running && (
          <button
            type="button"
            className={styles.iconBtn}
            data-ui="task-refresh"
            onClick={() => void query.refetch()}
            aria-label={t('refresh')}
          >
            <RefreshCw aria-hidden="true" className={query.isRefetching ? styles.spinning : undefined} />
          </button>
        )}
        <button
          type="button"
          className={styles.iconBtn}
          data-ui="task-copy"
          onClick={() => void copyLink()}
          aria-label={t('copy')}
        >
          <Copy aria-hidden="true" />
        </button>
      </div>

      {copied && (
        <span className={styles.copyToast} role="status" aria-live="polite">
          {t('copied')}
        </span>
      )}

      {/* A failed sync keeps the last known business state on screen; it must
          never be rendered as a FAILED task. */}
      {query.isError && (
        <div className={styles.syncBar} role="alert">
          <span>{t('syncError')}</span>
          <button type="button" onClick={() => void query.refetch()}>
            {t('queryAgain')}
          </button>
        </div>
      )}

      {previewOpen && resultUrl && (
        <ImagePreview
          src={resultUrl}
          alt={t('imageResult')}
          closeLabel={t('close')}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </article>
  );
}

export function TaskList({
  variant = 'full',
  templateId,
}: {
  variant?: 'panel' | 'full';
  templateId?: number;
}) {
  const { user, t, isSignedIn, openLogin } = useUser();
  const [page, setPage] = useState(0);
  const panel = variant === 'panel';
  const currentPage = panel ? 0 : page;
  const rootClass = panel ? styles.panelRoot : styles.listRoot;

  const query = useQuery({
    queryKey: ['tasks', user, currentPage, templateId ?? 'all'],
    queryFn: ({ signal }) =>
      api<Task[]>(
        `/tasks?page=${currentPage}${templateId ? `&templateId=${templateId}` : ''}`,
        { signal },
        user,
      ),
    enabled: isSignedIn,
  });

  if (!isSignedIn) {
    return (
      <div className={rootClass}>
        <div className={styles.state}>
          <ImageIcon size={24} aria-hidden="true" />
          <strong>{t('noAccount')}</strong>
          <span>{t('authPrompt')}</span>
          <button type="button" className={styles.stateBtn} onClick={openLogin}>
            {t('signIn')}
          </button>
        </div>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className={rootClass} aria-busy="true">
        <div className={panel ? styles.panelGrid : styles.grid}>
          {Array.from({ length: panel ? 3 : 8 }, (_, index) => (
            <div key={index} className={styles.skeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={rootClass}>
        <div className={styles.state} role="alert">
          <strong>{t('loadHistoryFailed')}</strong>
          <button type="button" className={styles.stateBtn} onClick={() => void query.refetch()}>
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  // The detail-page panel mirrors the reference: one row of the latest three
  // tasks; the full /history page shows everything with pagination.
  const tasks = panel ? query.data.slice(0, 3) : query.data;

  return (
    <div className={rootClass}>
      {tasks.length ? (
        panel ? (
          <div className={styles.panelScroll}>
            <div className={styles.panelGrid}>
              {tasks.map((task) => (
                <TaskCard key={task.id} initial={task} variant="panel" />
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {tasks.map((task) => (
              <TaskCard key={task.id} initial={task} variant="full" />
            ))}
          </div>
        )
      ) : (
        <div className={styles.state}>
          <ImageIcon size={24} aria-hidden="true" />
          <strong>{t('noTasks')}</strong>
          <span>{t('noTasksHint')}</span>
        </div>
      )}

      {!panel && (
        <nav className={styles.pagination}>
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            {t('previous')}
          </button>
          <span>
            {t('page')} {page + 1}
          </span>
          <button type="button" disabled={query.data.length < 20} onClick={() => setPage((value) => value + 1)}>
            {t('next')}
          </button>
        </nav>
      )}
    </div>
  );
}
