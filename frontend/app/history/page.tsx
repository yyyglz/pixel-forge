'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TaskList } from '@/components/task-list';
import { useUser } from '@/components/providers';
import styles from './page.module.css';

export default function HistoryPage() {
  const { t } = useUser();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('allWorks')}</h1>
        <Link className={styles.browse} href="/">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('browse')}
        </Link>
      </header>
      <TaskList variant="full" />
    </div>
  );
}
