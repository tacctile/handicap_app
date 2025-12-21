import React from 'react';
import './HorseExpandedView.css';
import type { HorseEntry } from '../types/drf';

interface HorseExpandedViewProps {
  horse: HorseEntry;
  isVisible: boolean;
  valuePercent?: number;
}

// Determine tier class based on value percentage
const getTierClass = (value: number): string => {
  if (value >= 100) return 'elite';
  if (value >= 50) return 'good';
  if (value >= 10) return 'fair';
  if (value >= -10) return 'neutral';
  return 'bad';
};

export const HorseExpandedView: React.FC<HorseExpandedViewProps> = ({
  horse: _horse,
  isVisible,
  valuePercent = 0,
}) => {
  if (!isVisible) return null;

  const tierClass = getTierClass(valuePercent);

  return (
    <div className={`horse-expanded-view horse-expanded-view--tier-${tierClass}`}>
      {/* Section 1: Furlong Scoring Breakdown (your value-add) */}
      <section className="horse-expanded-view__section horse-expanded-view__section--scoring">
        <div className="horse-expanded-view__section-placeholder">
          FURLONG SCORING BREAKDOWN
          <span className="horse-expanded-view__placeholder-note">(Prompt 4)</span>
        </div>
      </section>

      {/* Section 2: Horse Identity & Connections */}
      <section className="horse-expanded-view__section horse-expanded-view__section--identity">
        <div className="horse-expanded-view__section-placeholder">
          HORSE IDENTITY & CONNECTIONS
          <span className="horse-expanded-view__placeholder-note">
            (Color/Sex/Age, Breeding, Owner, Trainer, Jockey, Weight)
          </span>
          <span className="horse-expanded-view__placeholder-note">(Prompt 2)</span>
        </div>
      </section>

      {/* Section 3: Statistics Table */}
      <section className="horse-expanded-view__section horse-expanded-view__section--stats">
        <div className="horse-expanded-view__section-placeholder">
          STATISTICS TABLE
          <span className="horse-expanded-view__placeholder-note">
            (Lifetime, Current Year, Previous Year, Surface Splits)
          </span>
          <span className="horse-expanded-view__placeholder-note">(Prompt 3)</span>
        </div>
      </section>

      {/* Section 4: Past Performances */}
      <section className="horse-expanded-view__section horse-expanded-view__section--performances">
        <div className="horse-expanded-view__section-placeholder">
          PAST PERFORMANCES
          <span className="horse-expanded-view__placeholder-note">
            (Up to 10 race lines with full DRF data)
          </span>
          <span className="horse-expanded-view__placeholder-note">(Prompts 5-7)</span>
        </div>
      </section>

      {/* Section 5: Workouts */}
      <section className="horse-expanded-view__section horse-expanded-view__section--workouts">
        <div className="horse-expanded-view__section-placeholder">
          WORKOUTS
          <span className="horse-expanded-view__placeholder-note">(Up to 5 recent workouts)</span>
          <span className="horse-expanded-view__placeholder-note">(Prompt 8)</span>
        </div>
      </section>
    </div>
  );
};

export default HorseExpandedView;
