'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Template } from '@/lib/api';
import { MessageKey, templateCopy, templateCover } from '@/lib/i18n';
import { useUser } from '@/components/providers';
import styles from './page.module.css';

const CATEGORIES: { value: string; key: MessageKey }[] = [
  { value: '全部', key: 'all' },
  { value: '人像', key: 'catPortrait' },
  { value: '生活', key: 'catLife' },
  { value: '自然', key: 'catNature' },
  { value: '创意图片', key: 'catCreative' },
];

const SKELETONS = Array.from({ length: 6 }, (_, index) => index);

export default function TemplatesPage() {
  const { t, locale } = useUser();
  const [category, setCategory] = useState('全部');

  const templates = useQuery({
    queryKey: ['templates', category],
    queryFn: ({ signal }) =>
      api<Template[]>(
        '/templates' + (category === '全部' ? '' : `?category=${encodeURIComponent(category)}`),
        { signal },
      ),
  });

  const items = (templates.data ?? []).map((template) => templateCopy(template, locale));

  return (
    <>
      <div className={styles.subnav}>
        <Link href="/" className={`${styles.chip} ${styles.chipActive}`} aria-current="page">
          {t('navTemplates')}
        </Link>
        <Link href="/history" className={styles.chip}>
          {t('navHistory')}
        </Link>
      </div>

      <nav className={styles.filters} aria-label={t('filters')}>
        {CATEGORIES.map((item) => {
          const active = item.value === category;
          return (
            <button
              key={item.value}
              type="button"
              className={`${styles.filter} ${active ? styles.filterActive : ''}`}
              aria-pressed={active}
              onClick={() => setCategory(item.value)}
            >
              {t(item.key)}
            </button>
          );
        })}
      </nav>

      {templates.isPending ? (
        <div className={styles.loading} role="status">
          <span className="sr-only">{t('loading')}</span>
          <div className={styles.grid} aria-hidden="true">
            {SKELETONS.map((index) => (
              <div key={index} className={styles.skeleton} />
            ))}
          </div>
        </div>
      ) : templates.isError ? (
        <div className={styles.status} role="alert">
          <p>{t('loadFailed')}</p>
          <button type="button" className={styles.retry} onClick={() => void templates.refetch()}>
            {t('retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.status} role="status">
          <p>{t('noTemplates')}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((template) => (
            <Link key={template.id} href={`/templates/${template.id}`} className={styles.card}>
              {/* A plain <img> is enough here: covers are local static assets, already
                  sized by the fixed-ratio card, so the next/image optimizer is not needed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.cover}
                src={templateCover(template.coverUrl)}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.opacity = '0';
                }}
              />
              <span className={styles.scrim} aria-hidden="true" />
              <h2 className={styles.cardTitle}>{template.title}</h2>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
