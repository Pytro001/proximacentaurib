import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import styles from '../../styles/Globe.module.css';
import { CATEGORY_ORDER, CATEGORY_BLURB, getCategoryColor } from '../../lib/categoryColors';

function stopBubble(e: ReactPointerEvent | ReactTouchEvent) {
  e.stopPropagation();
}

export interface NotableObject {
  noradId: number;
  label: string;
}

export const NOTABLE_OBJECTS: NotableObject[] = [
  { noradId: 25544, label: 'ISS' },
  { noradId: 48274, label: 'Tiangong' },
  { noradId: 20580, label: 'Hubble' },
];

interface SatLayerPanelProps {
  /** category -> number of tracked objects in that category */
  counts: Record<string, number>;
  /** category -> whether its dots are currently shown */
  enabled: Record<string, boolean>;
  onToggle: (category: string) => void;
  onSetAll: (value: boolean) => void;
  totalTracked: number;
  totalVisible: number;
  /** which notable NORAD ids are present in the loaded catalog */
  notablePresent: Record<number, boolean>;
  onSelectNotable: (noradId: number) => void;
  onLocate: () => void;
  locating: boolean;
  locateError: string | null;
  overheadActive: boolean;
  onClearOverhead: () => void;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export default function SatLayerPanel({
  counts,
  enabled,
  onToggle,
  onSetAll,
  totalTracked,
  totalVisible,
  notablePresent,
  onSelectNotable,
  onLocate,
  locating,
  locateError,
  overheadActive,
  onClearOverhead,
}: SatLayerPanelProps) {
  const categories = CATEGORY_ORDER.filter((c) => (counts[c] || 0) > 0);
  // append any categories that aren't in the known order (defensive)
  for (const c of Object.keys(counts)) {
    if (!categories.includes(c) && counts[c] > 0) categories.push(c);
  }

  const allOn = categories.every((c) => enabled[c] !== false);

  const notable = NOTABLE_OBJECTS.filter((n) => notablePresent[n.noradId]);

  return (
    <div
      className={styles.satLayerPanel}
      data-globe-controls
      onPointerDownCapture={stopBubble}
      onPointerUpCapture={stopBubble}
      onTouchStartCapture={stopBubble}
    >
      <div className={styles.satLayerStat}>
        <span className={styles.satLayerStatNum}>{formatCount(totalTracked)}</span>
        <span className={styles.satLayerStatLabel}>objects tracked</span>
        {totalVisible !== totalTracked && (
          <span className={styles.satLayerStatSub}>{formatCount(totalVisible)} shown</span>
        )}
      </div>

      <button
        type="button"
        className={`${styles.locateBtn} ${overheadActive ? styles.locateBtnActive : ''}`}
        onClick={overheadActive ? onClearOverhead : onLocate}
        disabled={locating}
        title="Find the satellites passing over your location right now"
      >
        {locating ? (
          <>
            <span className={styles.satToggleSpinner} aria-hidden />
            Locating…
          </>
        ) : overheadActive ? (
          <>✕ Clear overhead</>
        ) : (
          <>◎ What&apos;s above me now</>
        )}
      </button>
      {locateError && <div className={styles.locateError}>{locateError}</div>}

      {notable.length > 0 && (
        <div className={styles.notableRow}>
          {notable.map((n) => (
            <button
              key={n.noradId}
              type="button"
              className={styles.notableChip}
              onClick={() => onSelectNotable(n.noradId)}
              title={`Fly to ${n.label}`}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.legendHeader}>
        <span className={styles.legendTitle}>Layers</span>
        <button
          type="button"
          className={styles.legendAllBtn}
          onClick={() => onSetAll(!allOn)}
        >
          {allOn ? 'Hide all' : 'Show all'}
        </button>
      </div>

      <div className={styles.legendList}>
        {categories.map((cat) => {
          const on = enabled[cat] !== false;
          return (
            <button
              key={cat}
              type="button"
              className={`${styles.legendRow} ${on ? '' : styles.legendRowOff}`}
              onClick={() => onToggle(cat)}
              aria-pressed={on}
              title={CATEGORY_BLURB[cat] || cat}
            >
              <span
                className={styles.legendDot}
                style={{
                  background: on ? getCategoryColor(cat) : 'transparent',
                  borderColor: getCategoryColor(cat),
                }}
                aria-hidden
              />
              <span className={styles.legendName}>{cat}</span>
              <span className={styles.legendCount}>{formatCount(counts[cat] || 0)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
