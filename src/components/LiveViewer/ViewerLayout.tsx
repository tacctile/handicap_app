/**
 * ViewerLayout Component
 *
 * Main layout for the live session viewer.
 * Shows session info, race list, and handles navigation.
 */

import React, { useState, useMemo } from 'react';
import { useLiveSessionViewer } from '../../hooks/useLiveSessionViewer';
import { ViewerRaceList } from './ViewerRaceList';
import { ViewerRaceDetail } from './ViewerRaceDetail';
import { ViewerMultiRace } from './ViewerMultiRace';
import './LiveViewer.css';

interface ViewerLayoutProps {
  /** Share code from URL */
  shareCode: string;
  /** Callback to exit viewer (go to home) */
  onExit: () => void;
}

type ViewerView = 'list' | 'race-detail' | 'multi-race-detail';

export const ViewerLayout: React.FC<ViewerLayoutProps> = ({ shareCode, onExit }) => {
  const {
    session,
    races,
    multiRaceBets,
    isLoading,
    error,
    lastUpdated,
    viewerCount,
    getRace,
    getHorsesForRace,
  } = useLiveSessionViewer(shareCode);

  const [currentView, setCurrentView] = useState<ViewerView>('list');
  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number | null>(null);
  const [selectedMultiRaceIndex, setSelectedMultiRaceIndex] = useState<number | null>(null);

  // Calculate time since last update
  const timeSinceUpdate = useMemo(() => {
    if (!lastUpdated) return null;
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds} sec ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    return 'over an hour ago';
  }, [lastUpdated]);

  // Handle viewing a race
  const handleViewRace = (raceNumber: number) => {
    setSelectedRaceNumber(raceNumber);
    setCurrentView('race-detail');
  };

  // Handle viewing a multi-race bet
  const handleViewMultiRace = (index: number) => {
    setSelectedMultiRaceIndex(index);
    setCurrentView('multi-race-detail');
  };

  // Handle back navigation
  const handleBack = () => {
    setCurrentView('list');
    setSelectedRaceNumber(null);
    setSelectedMultiRaceIndex(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="viewer-layout viewer-layout--loading">
        <div className="viewer-layout__loading">
          <div className="viewer-layout__spinner"></div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state (session not found or expired)
  if (error || !session) {
    return (
      <div className="viewer-layout viewer-layout--error">
        <div className="viewer-layout__error-content">
          <span className="viewer-layout__error-icon">😕</span>
          <h2>SESSION NOT FOUND</h2>
          <p>
            {error || 'This sharing link is invalid or has expired.'}
          </p>
          <p className="viewer-layout__error-hint">
            Sharing sessions expire after 24 hours.
            <br />
            Ask your friend to share a new link!
          </p>
          <button className="viewer-layout__error-btn" onClick={onExit}>
            GO TO FURLONG HOME
          </button>
        </div>
      </div>
    );
  }

  // Format race date
  const raceDate = new Date(session.raceDate);
  const formattedDate = raceDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Get selected race data for detail view
  const selectedRace = selectedRaceNumber ? getRace(selectedRaceNumber) : null;
  const selectedHorses = selectedRaceNumber ? getHorsesForRace(selectedRaceNumber) : [];
  const selectedMultiRace =
    selectedMultiRaceIndex !== null ? multiRaceBets[selectedMultiRaceIndex] : null;

  return (
    <div className="viewer-layout">
      {/* Header */}
      <header className="viewer-layout__header">
        <div className="viewer-layout__header-top">
          <div className="viewer-layout__header-left">
            <span className="viewer-layout__icon">🎯</span>
            <div className="viewer-layout__title-group">
              <h1 className="viewer-layout__title">LIVE PICKS</h1>
              <div className="viewer-layout__subtitle">
                {session.trackName} &bull; {formattedDate}
              </div>
            </div>
          </div>
          <div className="viewer-layout__live-badge">
            <span className="viewer-layout__live-dot"></span>
            LIVE
          </div>
        </div>

        <div className="viewer-layout__header-info">
          <span className="viewer-layout__viewers">
            {viewerCount} viewer{viewerCount !== 1 ? 's' : ''} watching
          </span>
          {timeSinceUpdate && (
            <span className="viewer-layout__updated">
              Updated: {timeSinceUpdate}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="viewer-layout__content">
        {currentView === 'list' && (
          <ViewerRaceList
            races={races}
            multiRaceBets={multiRaceBets}
            onViewRace={handleViewRace}
            onViewMultiRace={handleViewMultiRace}
          />
        )}

        {currentView === 'race-detail' && selectedRace && (
          <ViewerRaceDetail
            race={selectedRace}
            horses={selectedHorses}
            trackName={session.trackName}
            onBack={handleBack}
          />
        )}

        {currentView === 'multi-race-detail' && selectedMultiRace && (
          <ViewerMultiRace
            multiRaceBet={selectedMultiRace}
            races={races}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
};

export default ViewerLayout;
