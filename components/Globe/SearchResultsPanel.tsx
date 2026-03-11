import styles from '../../styles/Globe.module.css';
import type { SatelliteSearchResult } from '../../lib/satellites';

interface SearchResultsPanelProps {
  query: string;
  results: SatelliteSearchResult[];
  onSelect: (noradId: number) => void;
  onClose: () => void;
}

export default function SearchResultsPanel({
  query,
  results,
  onSelect,
  onClose,
}: SearchResultsPanelProps) {
  if (!query || query.trim().length < 2) return null;

  return (
    <div className={styles.searchResultsPanel}>
      <div className={styles.searchResultsHeader}>
        <h3 className={styles.searchResultsTitle}>
          Search: &quot;{query}&quot;
        </h3>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          −
        </button>
      </div>
      <div className={styles.searchResultsList}>
        {results.length === 0 ? (
          <p className={styles.searchResultsEmpty}>No satellites found</p>
        ) : (
          results.map((r) => (
            <button
              key={r.noradId}
              type="button"
              className={styles.searchResultItem}
              onClick={() => onSelect(r.noradId)}
            >
              <span className={styles.searchResultName}>{r.name}</span>
              <span className={styles.searchResultCategory}>{r.category}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
