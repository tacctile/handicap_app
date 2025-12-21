import React from 'react';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  return (
    <div className="app-shell">
      {/* TOP BAR - Full width, always visible */}
      <header className="app-topbar">
        <div className="app-topbar__logo">
          <div className="app-topbar__logo-icon">
            <span className="material-icons">casino</span>
          </div>
          <span className="app-topbar__logo-text">Furlong</span>
        </div>
        <div className="app-topbar__content">
          {/* Placeholder for top bar content - to be defined later */}
        </div>
      </header>

      {/* BODY - Main + Betting Panel */}
      <div className="app-body">
        {/* MAIN CONTENT - 2/3 width */}
        <main className="app-main">
          <div className="app-main__content">
            {/* Placeholder for race tabs + horse table */}
            <div className="app-main__placeholder">
              <span
                className="material-icons"
                style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
              >
                analytics
              </span>
              <h2>Race Analysis</h2>
              <p>Race tabs and horse table will appear here</p>
            </div>
          </div>
        </main>

        {/* BETTING PANEL - 1/3 width, always visible */}
        <aside className="app-betting-panel">
          <div className="app-betting-panel__content">
            {/* Bankroll summary section */}
            <div className="app-betting-panel__section">
              <h3 className="app-betting-panel__section-title">Bankroll</h3>
              <div className="app-betting-panel__placeholder">
                Bankroll summary will appear here
              </div>
            </div>

            {/* Betting recommendations section */}
            <div className="app-betting-panel__section">
              <h3 className="app-betting-panel__section-title">Recommendations</h3>
              <div className="app-betting-panel__placeholder">
                Betting recommendations will appear here
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM BAR */}
      <footer className="app-bottombar">
        {/* Left cluster - Account & Settings */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">person</span>
            <span>Guest</span>
          </button>
          <button className="app-bottombar__item">
            <span className="material-icons">settings</span>
            <span>Settings</span>
          </button>
        </div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Center spacer */}
        <div className="app-bottombar__spacer"></div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Right cluster - Help */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">help_outline</span>
            <span>Help</span>
          </button>
        </div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Legal */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">gavel</span>
            <span>Legal</span>
          </button>
        </div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Icon-only cluster - Fullscreen, Multi-window */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item app-bottombar__item--icon-only" title="Fullscreen">
            <span className="material-icons">fullscreen</span>
          </button>
          <button
            className="app-bottombar__item app-bottombar__item--icon-only"
            title="Multi-window"
          >
            <span className="material-icons">open_in_new</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
