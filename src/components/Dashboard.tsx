import React, { useState } from 'react';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

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

      {/* BODY - Sidebar + Main */}
      <div className="app-body">
        {/* SIDEBAR - Collapsible */}
        <aside
          className={`app-sidebar ${sidebarExpanded ? 'app-sidebar--expanded' : 'app-sidebar--collapsed'}`}
        >
          {/* Collapse/Expand Toggle Tab */}
          <button
            className="app-sidebar__toggle"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="material-icons">
              {sidebarExpanded ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>

          {/* Primary Navigation */}
          <nav className="app-sidebar__nav">
            <button className="app-sidebar__item app-sidebar__item--active">
              <span className="material-icons">dashboard</span>
              {sidebarExpanded && <span className="app-sidebar__label">Dashboard</span>}
            </button>
            <button className="app-sidebar__item">
              <span className="material-icons">person</span>
              {sidebarExpanded && <span className="app-sidebar__label">Account</span>}
            </button>
            <button className="app-sidebar__item">
              <span className="material-icons">help_outline</span>
              {sidebarExpanded && <span className="app-sidebar__label">Help Center</span>}
            </button>
            <button className="app-sidebar__item">
              <span className="material-icons">settings</span>
              {sidebarExpanded && <span className="app-sidebar__label">Settings</span>}
            </button>
          </nav>

          {/* Spacer */}
          <div className="app-sidebar__spacer"></div>

          {/* Secondary Navigation */}
          <nav className="app-sidebar__nav">
            <button className="app-sidebar__item">
              <span className="material-icons">fullscreen</span>
              {sidebarExpanded && <span className="app-sidebar__label">Fullscreen</span>}
            </button>
            <button className="app-sidebar__item">
              <span className="material-icons">open_in_new</span>
              {sidebarExpanded && <span className="app-sidebar__label">Multi-window</span>}
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="app-main">
          {/* Placeholder content */}
          <div className="app-main__placeholder">
            <span
              className="material-icons"
              style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
            >
              construction
            </span>
            <h2>New Dashboard</h2>
            <p>Shell layout complete. Content coming soon.</p>
            <p style={{ marginTop: 'var(--gap-container)', opacity: 0.5 }}>
              Visit{' '}
              <a href="/legacy" style={{ color: 'var(--color-primary)' }}>
                /legacy
              </a>{' '}
              to see the original dashboard
            </p>
          </div>
        </main>
      </div>

      {/* BOTTOM BAR */}
      <footer className="app-bottombar">
        <button className="app-bottombar__item">
          <span className="material-icons">gavel</span>
          <span>Legal</span>
        </button>
        <div className="app-bottombar__spacer"></div>
        {/* Future items will go here */}
      </footer>
    </div>
  );
};

export default Dashboard;
