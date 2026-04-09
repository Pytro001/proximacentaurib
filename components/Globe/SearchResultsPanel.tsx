import styles from '../../styles/Globe.module.css';

export type SearchResult =
  | { type: 'satellite'; noradId: number; name: string; category: string }
  | { type: 'orbiter'; id: string; name: string; category: string; lat: number; lng: number; alt: number; body: 'moon' | 'mars' };

interface SearchResultsPanelProps {
  query: string;
  results: SearchResult[];
  isLoading?: boolean;
  satellitesEnabled?: boolean;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}

export default function SearchResultsPanel({
  query,
  results,
  isLoading = false,
  satellitesEnabled = true,
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
        {isLoading ? (
          <p className={styles.searchResultsEmpty}>Loading...</p>
        ) : results.length === 0 ? (
          <p className={styles.searchResultsEmpty}>
            {!satellitesEnabled
              ? 'No matches. Turn on the bottom-left overlay (satellites on Earth, spacecraft on Moon/Mars) to search.'
              : 'No matches for this search.'}
          </p>
        ) : (
          results.map((r) => (
            <button
              key={r.type === 'satellite' ? r.noradId : r.id}
              type="button"
              className={styles.searchResultItem}
              onClick={() => onSelect(r)}
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
