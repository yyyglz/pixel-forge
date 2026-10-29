'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { api, Asset, Template } from '@/lib/api';
import { localizeError, templateCopy, templateCover } from '@/lib/i18n';
import { useUser } from '@/components/providers';
import { TaskList } from '@/components/task-list';
import styles from './detail.module.css';

type Slot = { status: 'uploading' | 'ready' | 'error'; asset?: Asset; message?: string };
type Notice = { kind: 'success' | 'error'; text: string };

const OUTCOMES = ['NONE', 'ASSET_CHECK', 'GENERATING', 'FINALIZING'] as const;
const OUTCOME_LABEL = {
  NONE: 'success',
  ASSET_CHECK: 'assetFail',
  GENERATING: 'generateFail',
  FINALIZING: 'finalFail',
} as const;

export default function TemplateDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { user, t, locale, isSignedIn, openLogin } = useUser();
  const client = useQueryClient();

  const [slots, setSlots] = useState<Record<number, Slot>>({});
  const [failAt, setFailAt] = useState<string>('NONE');
  const [delay, setDelay] = useState(2000);
  const [demoOpen, setDemoOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const requests = useRef<Map<number, AbortController>>(new Map());

  // Abort any in-flight upload when the page unmounts; replacements abort the
  // previous request for the same slot inside `upload`.
  useEffect(() => {
    const current = requests.current;
    return () => {
      current.forEach((controller) => controller.abort());
      current.clear();
    };
  }, []);

  const templateQuery = useQuery({
    queryKey: ['template', id],
    queryFn: ({ signal }) => api<Template>(`/templates/${id}`, { signal }),
  });

  const submit = useMutation({
    mutationFn: (assetIds: string[]) =>
      api<{ taskId: string }>(
        '/tasks',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: id,
            assetIds,
            failAt,
            ...(delay === 2000 ? {} : { stageDelayMs: delay }),
          }),
        },
        user,
      ),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: 'success', text: t('accepted') });
      void client.invalidateQueries({ queryKey: ['tasks', user] });
      void client.invalidateQueries({ queryKey: ['demo-account', user] });
    },
    onError: (error) =>
      setNotice({
        kind: 'error',
        text: localizeError(error.message, locale) || t('submitFailed'),
      }),
  });

  async function upload(index: number, file: File) {
    requests.current.get(index)?.abort();
    const controller = new AbortController();
    requests.current.set(index, controller);
    setSlots((current) => ({ ...current, [index]: { status: 'uploading' } }));
    const form = new FormData();
    form.append('file', file);
    try {
      const asset = await api<Asset>('/assets', { method: 'POST', body: form, signal: controller.signal }, user);
      if (!controller.signal.aborted) {
        setSlots((current) => ({ ...current, [index]: { status: 'ready', asset } }));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSlots((current) => ({
          ...current,
          [index]: {
            status: 'error',
            message: error instanceof Error ? localizeError(error.message, locale) : t('loadFailed'),
          },
        }));
      }
    } finally {
      if (requests.current.get(index) === controller) requests.current.delete(index);
    }
  }

  function remove(index: number) {
    requests.current.get(index)?.abort();
    requests.current.delete(index);
    setSlots((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  const tasksFetching = useIsFetching({ queryKey: ['tasks', user] }) > 0;

  if (templateQuery.isPending) {
    return (
      <div className={styles.statePage}>
        <div className={styles.stateCard} role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (templateQuery.isError || !templateQuery.data) {
    const message = templateQuery.error instanceof Error ? templateQuery.error.message : '';
    const missing = message.includes('模板不存在') || /template not found/i.test(message);
    return (
      <div className={styles.statePage}>
        <div className={styles.stateCard}>
          <strong>{missing ? t('notFoundTitle') : t('loadFailed')}</strong>
          {missing && <p>{t('notFoundHint')}</p>}
          {missing ? (
            <Link className={styles.stateBtn} href="/">
              <ArrowLeft size={14} aria-hidden="true" />
              {t('back')}
            </Link>
          ) : (
            <button type="button" className={styles.stateBtn} onClick={() => void templateQuery.refetch()}>
              {t('retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const template = templateCopy(templateQuery.data, locale);
  const assetIds = Array.from({ length: template.requiredImageCount }, (_, index) => slots[index]?.asset?.assetId).filter(
    (value): value is string => Boolean(value),
  );
  const ready = assetIds.length === template.requiredImageCount;
  const delayValid = delay >= 500 && delay <= 10000;
  const canSubmit = isSignedIn && ready && delayValid && !submit.isPending;

  return (
    <div className={styles.studio}>
      <section className={`${styles.panel} ${styles.panelLeft}`}>
        <div className={styles.topRow}>
          <Link href="/" className={styles.back} aria-label={t('back')}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
          <h1 className={styles.title}>{template.title}</h1>
          <button
            type="button"
            className={styles.demoToggle}
            data-ui="demo-toggle"
            aria-label={t('demo')}
            aria-expanded={demoOpen}
            aria-controls="detail-demo-controls"
            onClick={() => setDemoOpen((open) => !open)}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.cover}>
          <img className={styles.coverImg} src={templateCover(template.coverUrl)} alt={template.title} />
        </div>

        <div className={styles.uploadHead}>
          <h2 className={styles.uploadTitle}>{t('upload')}</h2>
          <p className={styles.uploadReq}>
            {template.requiredImageCount} {t('imageUnit')} · {t('requirements')}
          </p>
        </div>

        {isSignedIn ? (
          <div
            className={styles.slots}
            style={{ gridTemplateColumns: `repeat(${template.requiredImageCount}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: template.requiredImageCount }, (_, index) => {
              const slot = slots[index];
              const uploading = slot?.status === 'uploading';
              const asset = slot?.status === 'ready' ? slot.asset : undefined;
              return (
                <div className={styles.slot} key={index}>
                  <label className={asset ? `${styles.slotBody} ${styles.slotBodyReady}` : styles.slotBody}>
                    <input
                      type="file"
                      className="sr-only"
                      accept={template.acceptedMimeTypes || 'image/jpeg,image/png'}
                      disabled={uploading}
                      aria-label={`${asset ? t('replace') : t('upload')} ${index + 1}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        const accepted = (template.acceptedMimeTypes || 'image/jpeg,image/png')
                          .split(',')
                          .map((type) => type.trim());
                        if (file.type && !accepted.includes(file.type)) {
                          setSlots((current) => ({
                            ...current,
                            [index]: { status: 'error', message: t('fileTypeError') },
                          }));
                          return;
                        }
                        if (file.size > template.maxFileSizeBytes) {
                          setSlots((current) => ({
                            ...current,
                            [index]: { status: 'error', message: t('fileSizeError') },
                          }));
                          return;
                        }
                        void upload(index, file);
                      }}
                    />
                    {asset ? (
                      <>
                        <img className={styles.preview} src={asset.previewUrl} alt={`${t('image')} ${index + 1}`} />
                        <span className={styles.replacePill}>{t('replace')}</span>
                      </>
                    ) : uploading ? (
                      <span className={styles.slotStatus}>
                        <LoaderCircle className="spin" size={20} aria-hidden="true" />
                        <span>{t('uploading')}</span>
                      </span>
                    ) : slot?.status === 'error' ? (
                      <span className={styles.slotStatus}>
                        <span className={styles.errorText}>{slot.message || t('uploadFailed')}</span>
                        <span className={styles.reuploadText}>{t('reupload')}</span>
                      </span>
                    ) : (
                      <>
                        <span className={styles.iconCircle}>
                          <ImagePlus size={18} aria-hidden="true" />
                        </span>
                        <span className={styles.chooseText}>{t('choose')}</span>
                      </>
                    )}
                  </label>
                  {asset && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      aria-label={`${t('remove')} ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${styles.slot} ${styles.loginSlot}`}>
            <div className={styles.slotStatus}>
              <span className={styles.chooseText}>{t('loginToCreate')}</span>
              <button type="button" className={styles.loginBtn} onClick={openLogin}>
                {t('signIn')}
              </button>
            </div>
          </div>
        )}

        <div className={styles.spacer} />

        {demoOpen && (
          <section id="detail-demo-controls" className={styles.demoPanel} aria-label={t('demo')}>
            <label className={styles.demoField}>
              <span>{t('outcome')}</span>
              <select
                className={`${styles.control} ${styles.demoSelect}`}
                value={failAt}
                onChange={(event) => setFailAt(event.target.value)}
              >
                {OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {t(OUTCOME_LABEL[outcome])}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.demoField}>
              <span>{t('delay')}</span>
              <input
                className={`${styles.control} ${styles.demoNumber}`}
                type="number"
                min={500}
                max={10000}
                step={500}
                value={delay}
                onChange={(event) => setDelay(Number(event.target.value))}
              />
            </label>
          </section>
        )}

        <div className={styles.submitArea}>
          {notice && (
            <p
              className={`${styles.notice} ${notice.kind === 'success' ? styles.noticeSuccess : styles.noticeError}`}
              role="status"
            >
              {notice.kind === 'success' && <CheckCircle2 size={14} aria-hidden="true" />}
              <span>{notice.text}</span>
            </p>
          )}
          <button
            type="button"
            className={styles.createBtn}
            data-ui="create"
            data-loading={submit.isPending}
            disabled={!canSubmit}
            onClick={() => submit.mutate(assetIds)}
          >
            {submit.isPending ? (
              <>
                <LoaderCircle className="spin" size={15} aria-hidden="true" />
                {t('creating')}
              </>
            ) : (
              <>
                {t('create')}
                <Sparkles size={14} aria-hidden="true" />
                <span>100</span>
              </>
            )}
          </button>
        </div>
      </section>

      <aside className={`${styles.panel} ${styles.panelRight}`}>
        <header className={styles.historyHead}>
          <h2 className={styles.historyTitle}>{t('history')}</h2>
          <button
            type="button"
            className={styles.refreshBtn}
            data-ui="history-refresh"
            aria-label={t('refresh')}
            onClick={() => void client.refetchQueries({ queryKey: ['tasks', user] })}
          >
            <RefreshCw size={18} aria-hidden="true" className={tasksFetching ? 'spin' : undefined} />
          </button>
        </header>
        <TaskList variant="panel" />
      </aside>
    </div>
  );
}
