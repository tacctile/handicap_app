import { memo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BettingDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  bankrollContent: ReactNode;
  recommendationsContent: ReactNode;
}

export const BettingDrawer = memo(function BettingDrawer({
  isOpen,
  onToggle,
  bankrollContent,
  recommendationsContent,
}: BettingDrawerProps) {
  return (
    <div className={`betting-drawer ${isOpen ? 'expanded' : 'collapsed'}`}>
      {/* Toggle button (visible when collapsed) */}
      {!isOpen && (
        <button
          className="betting-drawer-toggle"
          onClick={onToggle}
          aria-label="Open betting drawer"
          aria-expanded={isOpen}
        >
          <span className="material-icons">chevron_left</span>
        </button>
      )}

      {/* Header (visible when expanded) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="betting-drawer-header">
              <div className="betting-drawer-title">
                <span className="material-icons">casino</span>
                <span>Betting</span>
              </div>
              <button
                className="betting-drawer-collapse-btn"
                onClick={onToggle}
                aria-label="Collapse betting drawer"
              >
                <span className="material-icons">chevron_right</span>
              </button>
            </div>

            {/* Content */}
            <div className="betting-drawer-content">
              {/* Bankroll section - fixed, does not scroll */}
              <div className="betting-drawer-bankroll">{bankrollContent}</div>

              {/* Recommendations section - scrollable */}
              <div className="betting-drawer-recommendations">{recommendationsContent}</div>

              {/* Charts placeholder */}
              <div className="betting-drawer-charts">
                <div className="betting-drawer-charts-placeholder">[Charts - Coming Soon]</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default BettingDrawer;
