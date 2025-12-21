import { motion } from 'framer-motion';
import { EmptyRaceIllustration, UploadDocumentIllustration } from '../../assets/illustrations';
import { StaggerContainer, StaggerItem, Skeleton } from '../motion';

interface EmptyStateTableProps {
  onUploadClick?: () => void;
  isLoading?: boolean;
}

const tableHeaders = [
  { key: 'pp', label: 'PP', width: '60px' },
  { key: 'horse', label: 'Horse', width: '200px' },
  { key: 'trainer', label: 'Trainer', width: '150px' },
  { key: 'jockey', label: 'Jockey', width: '150px' },
  { key: 'score', label: 'Score', width: '80px' },
  { key: 'odds', label: 'Odds', width: '80px' },
  { key: 'actions', label: 'Actions', width: '100px' },
];

export function EmptyStateTable({ onUploadClick, isLoading }: EmptyStateTableProps) {
  // Generate skeleton rows
  const skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="empty-state-table-container">
      {/* Table header section */}
      <div className="empty-table-header">
        <div className="empty-table-title">
          <span className="material-icons">format_list_numbered</span>
          <h3>Horse Analysis</h3>
        </div>
        <div className="empty-table-subtitle">Complete handicapping breakdown for each entry</div>
      </div>

      {/* Actual table with headers */}
      <div className="empty-table-wrapper">
        <table className="empty-table" role="grid" aria-label="Horse analysis table">
          <thead>
            <tr>
              {tableHeaders.map((header) => (
                <th key={header.key} style={{ width: header.width }} scope="col">
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? // Loading skeleton rows
                skeletonRows.map((i) => (
                  <tr key={i} className="skeleton-row">
                    <td>
                      <Skeleton width="32px" height="32px" className="rounded" />
                    </td>
                    <td>
                      <Skeleton width="140px" height="16px" />
                    </td>
                    <td>
                      <Skeleton width="100px" height="16px" />
                    </td>
                    <td>
                      <Skeleton width="100px" height="16px" />
                    </td>
                    <td>
                      <Skeleton width="48px" height="28px" className="rounded" />
                    </td>
                    <td>
                      <Skeleton width="48px" height="20px" />
                    </td>
                    <td>
                      <Skeleton width="60px" height="28px" className="rounded" />
                    </td>
                  </tr>
                ))
              : // Empty state rows with pattern
                skeletonRows.map((i) => (
                  <tr key={i} className="empty-row">
                    <td>
                      <div className="empty-pp-badge">{i + 1}</div>
                    </td>
                    <td>
                      <div className="empty-cell-placeholder" />
                    </td>
                    <td>
                      <div className="empty-cell-placeholder short" />
                    </td>
                    <td>
                      <div className="empty-cell-placeholder short" />
                    </td>
                    <td>
                      <div className="empty-score-badge">—</div>
                    </td>
                    <td>
                      <div className="empty-odds">—</div>
                    </td>
                    <td>
                      <div className="empty-action-btn">
                        <span className="material-icons">visibility</span>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Overlay with upload prompt */}
        {!isLoading && (
          <motion.div
            className="empty-table-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <StaggerContainer className="empty-table-prompt">
              <StaggerItem>
                <EmptyRaceIllustration className="empty-table-illustration" />
              </StaggerItem>
              <StaggerItem>
                <h4 className="empty-table-prompt-title">Upload DRF file to analyze race</h4>
              </StaggerItem>
              <StaggerItem>
                <p className="empty-table-prompt-text">
                  Get comprehensive handicapping analysis with AI-powered insights
                </p>
              </StaggerItem>
              <StaggerItem>
                <div className="empty-table-arrow">
                  <motion.span
                    className="material-icons"
                    animate={{ y: [-5, 5, -5] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    arrow_upward
                  </motion.span>
                  <span>Click Upload File to begin</span>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </motion.div>
        )}
      </div>

      {/* Mobile empty state */}
      <div className="empty-table-mobile">
        <UploadDocumentIllustration className="empty-mobile-illustration" />
        <h4>Upload DRF File</h4>
        <p>Analyze race entries with advanced AI handicapping</p>
        {onUploadClick && (
          <button className="empty-mobile-btn" onClick={onUploadClick}>
            <span className="material-icons">upload_file</span>
            Select File
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyStateTable;
