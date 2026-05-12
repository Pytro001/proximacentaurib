import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import styles from '../../styles/Globe.module.css';

function stopStagePointerBubble(e: ReactPointerEvent | ReactTouchEvent) {
  e.stopPropagation();
}

export type PlanetBodyId = 'earth' | 'moon' | 'mars';

interface ControlsPanelProps {
  body: PlanetBodyId;
  overlayEnabled: boolean;
  onOverlayEnabledChange: (enabled: boolean) => void;
  overlayLoading?: boolean;
}

export default function ControlsPanel({
  body,
  overlayEnabled,
  onOverlayEnabledChange,
  overlayLoading = false,
}: ControlsPanelProps) {
  const labelOff = 'Activate Live view';
  const labelOn = 'Live view on';

  return (
    <div
      className={styles.controlsWrap}
      data-globe-controls
      onPointerDownCapture={stopStagePointerBubble}
      onPointerUpCapture={stopStagePointerBubble}
      onTouchStartCapture={stopStagePointerBubble}
    >
      <div className={styles.satToggleRow}>
        <button
          type="button"
          className={`${styles.satToggleBtn} ${overlayEnabled ? styles.satToggleBtnOn : ''}`}
          aria-pressed={overlayEnabled}
          aria-label={overlayEnabled ? labelOn : labelOff}
          title={
            body === 'earth'
              ? 'Download satellite catalog and show objects in Earth orbit (heavy).'
              : 'Show major spacecraft orbiting this body.'
          }
          disabled={overlayLoading}
          onClick={() => onOverlayEnabledChange(!overlayEnabled)}
        >
          {overlayEnabled ? (
            <>
              <span className={styles.satToggleLiveDot} aria-hidden />
              {labelOn}
            </>
          ) : (
            labelOff
          )}
        </button>
        {overlayLoading && <span className={styles.satToggleSpinner} aria-hidden />}
      </div>
      <div className={styles.satToggleRow}>
        <a
          href="https://airsup.dev"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mfgBtn}
        >
          Start manufacturing
        </a>
      </div>
    </div>
  );
}
