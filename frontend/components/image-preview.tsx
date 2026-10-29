'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './image-preview.module.css';

/**
 * In-app image preview (lightbox). Used for uploaded material previews and
 * creation results so a preview never leaves the current page/tab.
 */
export function ImagePreview({
  src,
  alt,
  closeLabel,
  onClose,
}: {
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.frame}>
        <img className={styles.image} src={src} alt={alt} />
        <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
