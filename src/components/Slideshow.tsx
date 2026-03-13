import { useState, useCallback, useEffect } from 'react';
import './Slideshow.css';

interface SlideshowProps {
  onBack: () => void;
}

const TOTAL_SLIDES = 8;

export function Slideshow({ onBack }: SlideshowProps) {
  const [current, setCurrent] = useState(1);
  const [showRestart, setShowRestart] = useState(false);

  const goTo = useCallback((n: number) => {
    setCurrent(n);
  }, []);

  const forward = useCallback(() => {
    if (current < TOTAL_SLIDES) {
      goTo(current + 1);
    } else {
      setShowRestart(true);
      setTimeout(() => {
        setShowRestart(false);
        goTo(1);
      }, 1500);
    }
  }, [current, goTo]);

  const back = useCallback(() => {
    if (current > 1) goTo(current - 1);
  }, [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        forward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape') {
        onBack();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [forward, back, onBack]);

  return (
    <div className="ss-root">
      {/* Top bar */}
      <header className="ss-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="ss-logo">F</div>
        <span className="ss-brand">Furlong</span>
        <div className="ss-topbar-sep" />
        <span className="ss-topbar-ctx">
          <b>Platform Overview</b> · Presentation
        </span>
        <div className="ss-topbar-right">
          <button className="ss-btn-close" onClick={onBack}>
            ✕ Back to Furlong
          </button>
        </div>
      </header>

      {/* Deck — click anywhere to advance */}
      <main className="ss-deck" onClick={forward}>
        {/* Restart overlay */}
        {showRestart && (
          <div className="ss-restart">
            <div className="ss-restart-check">✓</div>
            <h2>You're all set</h2>
            <p>Restarting…</p>
          </div>
        )}

        {/* SLIDE 1: Platform Intro */}
        <div className={`ss-slide ${current === 1 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">INTRODUCING FURLONG</div>
          <h1 className="ss-title">Finding value the public misses.</h1>
          <p className="ss-subtitle">
            A 336-point scoring engine that identifies undervalued horses, builds
            optimized tickets, and tells you exactly what to say at the window —
            all offline.
          </p>

          <div className="ss-s1-grid">
            {/* Left column: value prop + ranking */}
            <div className="ss-s1-left">
              <div className="ss-s1-hero">
                We don't predict who wins.
                <br />
                We find horses the public is{' '}
                <em className="ss-em-teal">undervaluing</em>.
              </div>
              <p className="ss-s1-desc">
                Every bet at the track is priced by the crowd. When the crowd is
                wrong, Furlong finds those horses and builds smart tickets to
                capitalize.
              </p>

              <div className="ss-rank-header">WHERE FURLONG RANKS</div>
              <div className="ss-rank-list">
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">1</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      Ragozin / Thoro-Graph{' '}
                      <span className="ss-rank-tag ss-rank-tag--above">30+ YRS</span>
                    </div>
                    <div className="ss-rank-desc">
                      Decades of proprietary speed figures. Unmatched depth — but
                      no value detection, no tickets, years to learn.
                    </div>
                  </div>
                </div>
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">2</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      TimeformUS{' '}
                      <span className="ss-rank-tag ss-rank-tag--above">INDUSTRY STD</span>
                    </div>
                    <div className="ss-rank-desc">
                      Gold-standard pace figures. Trusted by pros — but manual
                      interpretation only, no betting output.
                    </div>
                  </div>
                </div>
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">3</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      DRF Formulator{' '}
                      <span className="ss-rank-tag ss-rank-tag--above">BIGGEST DB</span>
                    </div>
                    <div className="ss-rank-desc">
                      Biggest past-performance database. But raw data only — no
                      scoring, no value signals. You do all the work.
                    </div>
                  </div>
                </div>

                <div className="ss-rank-divider">
                  <span className="ss-rank-divider-label">FURLONG</span>
                </div>

                <div className="ss-rank-item ss-rank-item--highlight">
                  <div className="ss-rank-pos ss-rank-pos--highlight">4</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      Furlong{' '}
                      <span className="ss-rank-tag ss-rank-tag--us">FULL STACK</span>
                    </div>
                    <div className="ss-rank-desc">
                      336-point model. Live edge detection. Automated ticket
                      builder with Kelly sizing and window scripts. 100% offline.
                    </div>
                  </div>
                </div>

                <div className="ss-rank-divider">
                  <span className="ss-rank-divider-label ss-rank-divider-label--rest">
                    THE REST
                  </span>
                </div>

                <div className="ss-rank-item">
                  <div className="ss-rank-pos">5</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      BrisNet / Equibase{' '}
                      <span className="ss-rank-tag ss-rank-tag--below">DATA ONLY</span>
                    </div>
                    <div className="ss-rank-desc">
                      Reliable data, zero analysis. No scoring, no value
                      detection, no ticket output.
                    </div>
                  </div>
                </div>
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">6</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      Tout Services{' '}
                      <span className="ss-rank-tag ss-rank-tag--below">BLACK BOX</span>
                    </div>
                    <div className="ss-rank-desc">
                      Pay for picks, no transparency. No model access, no factor
                      breakdown.
                    </div>
                  </div>
                </div>
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">7</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      Free Tools{' '}
                      <span className="ss-rank-tag ss-rank-tag--below">SURFACE</span>
                    </div>
                    <div className="ss-rank-desc">
                      Basic figures and consensus picks. No edge calculation, no
                      ticket building.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: feature cards */}
            <div className="ss-s1-right">
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--teal" />
                <div>
                  <div className="ss-feat-title">336-Point Scoring Engine</div>
                  <div className="ss-feat-desc">
                    Every horse scored across 15 weighted categories — speed,
                    class, form, connections, pace, post position, equipment.
                    Pure math, no gut calls.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--green" />
                <div>
                  <div className="ss-feat-title">Live Value Detection</div>
                  <div className="ss-feat-desc">
                    Edge % compares our fair-odds model against the crowd.
                    Positive edge = the public is sleeping. This signal is unique
                    to Furlong.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--amber" />
                <div>
                  <div className="ss-feat-title">Ticket Builder + Kelly Sizing</div>
                  <div className="ss-feat-desc">
                    Set a budget, pick a risk mode. Furlong allocates across Win,
                    Exacta, Trifecta, Superfecta. Every ticket comes with a
                    window script.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--teal" />
                <div>
                  <div className="ss-feat-title">Zero-Dependency Offline</div>
                  <div className="ss-feat-desc">
                    Runs entirely on-device. No server calls, no wifi, no
                    subscription gating. Any DRF file, any North American track,
                    full capability offline.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--purple" />
                <div>
                  <div className="ss-feat-title">Transparent Methodology</div>
                  <div className="ss-feat-desc">
                    Every score decomposed into factors. Every recommendation
                    explainable. Every ticket verified against program numbers.
                    Nothing is a black box.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ss-footer-facts">
            <span>• Runs 100% offline at the track</span>
            <span>• Loads any DRF file, any North American track</span>
            <span>• Built for real bettors</span>
          </div>
        </div>

        {/* SLIDE 2: Race Analysis */}
        <div className={`ss-slide ${current === 2 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">RACE ANALYSIS</div>
          <h1 className="ss-title">Every horse. Every angle. One screen.</h1>
          <p className="ss-subtitle">
            Furlong scores each horse on 15 factors, then compares our fair odds
            to the public line to find where the value is hiding.
          </p>

          <div className="ss-s2-grid">
            <div className="ss-s2-left">
              {/* Mock race table */}
              <div className="ss-table">
                <div className="ss-table-head">
                  <span>#</span>
                  <span>HORSE</span>
                  <span>SCORE</span>
                  <span>ODDS</span>
                  <span>FAIR</span>
                  <span>EDGE</span>
                </div>
                {[
                  { post: 1, name: 'Jeremy', score: 292, odds: '5-2', fair: '3-2', edge: '+67%', tier: 'elite' },
                  { post: 2, name: 'Mattagio', score: 278, odds: '7-2', fair: '5-2', edge: '+40%', tier: 'good' },
                  { post: 3, name: 'Nick', score: 265, odds: '4-1', fair: '3-1', edge: '+33%', tier: 'good' },
                  { post: 4, name: 'Roger', score: 251, odds: '6-1', fair: '8-1', edge: '-25%', tier: 'bad' },
                  { post: 5, name: 'Brock', score: 244, odds: '8-1', fair: '6-1', edge: '+33%', tier: 'good' },
                  { post: 6, name: 'Katie', score: 230, odds: '10-1', fair: '12-1', edge: '-17%', tier: 'bad' },
                  { post: 7, name: 'Casey', score: 218, odds: '12-1', fair: '10-1', edge: '+20%', tier: 'fair' },
                  { post: 8, name: 'Brenda', score: 205, odds: '15-1', fair: '20-1', edge: '-25%', tier: 'bad' },
                  { post: 9, name: 'Danny', score: 198, odds: '20-1', fair: '15-1', edge: '+33%', tier: 'good' },
                  { post: 10, name: 'Ellie', score: 185, odds: '30-1', fair: '25-1', edge: '+20%', tier: 'fair' },
                  { post: 11, name: 'Shaun', score: 172, odds: '50-1', fair: '50-1', edge: '0%', tier: 'neutral' },
                  { post: 12, name: 'Angelina', score: 160, odds: '50-1', fair: '40-1', edge: '+25%', tier: 'fair' },
                ].map((h) => (
                  <div
                    key={h.post}
                    className={`ss-table-row ${h.tier === 'elite' ? 'ss-table-row--elite' : ''}`}
                  >
                    <span className="ss-table-post">{h.post}</span>
                    <span className="ss-table-name">{h.name}</span>
                    <span className="ss-table-score">{h.score}</span>
                    <span>{h.odds}</span>
                    <span>{h.fair}</span>
                    <span className={`ss-table-edge ss-table-edge--${h.tier}`}>
                      {h.edge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ss-s2-right">
              <div className="ss-callout">
                <div className="ss-callout-label">WHAT THE TABLE SHOWS</div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">SCORE</span>
                  <span>Composite of 15 weighted factors (max 336)</span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">ODDS</span>
                  <span>Current public morning line</span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">FAIR</span>
                  <span>What Furlong thinks the odds should be</span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key ss-callout-key--edge">EDGE</span>
                  <span>
                    Gap between public odds and fair odds. Positive = value bet.
                  </span>
                </div>
              </div>
              <div className="ss-callout ss-callout--signal">
                <div className="ss-callout-label">READING THE SIGNAL</div>
                <p className="ss-callout-text">
                  <b className="ss-teal">Jeremy</b> is going off at 5-2 but
                  Furlong calculates fair odds of 3-2. That's a{' '}
                  <b className="ss-green">+67% edge</b> — the public is
                  undervaluing him significantly.
                </p>
                <p className="ss-callout-text">
                  <b className="ss-teal">Roger</b> at 6-1 has fair odds of 8-1.
                  That's a <b className="ss-red">-25% edge</b> — the crowd
                  already priced him too low. He's overbet.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 3: Horse Card */}
        <div className={`ss-slide ${current === 3 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">HORSE CARD</div>
          <h1 className="ss-title">The full picture on every contender.</h1>
          <p className="ss-subtitle">
            Tap any horse to expand their card. Every scoring factor, broken down
            and weighted — nothing hidden.
          </p>

          <div className="ss-s3-grid">
            <div className="ss-horse-card">
              <div className="ss-hc-header">
                <div className="ss-hc-post">1</div>
                <div className="ss-hc-info">
                  <div className="ss-hc-name">Jeremy</div>
                  <div className="ss-hc-detail">
                    J. Castellano · T. Pletcher · 5-2 ML
                  </div>
                </div>
                <div className="ss-hc-score">
                  <div className="ss-hc-score-num">292</div>
                  <div className="ss-hc-score-label">/ 336</div>
                </div>
              </div>

              <div className="ss-hc-factors">
                <div className="ss-hc-section-label">SCORING FACTORS</div>
                <div className="ss-factor-grid">
                  {[
                    { name: 'Speed', score: 44, max: 48, pct: 92 },
                    { name: 'Class', score: 40, max: 44, pct: 91 },
                    { name: 'Form Cycle', score: 36, max: 40, pct: 90 },
                    { name: 'Pace', score: 30, max: 36, pct: 83 },
                    { name: 'Connections', score: 28, max: 32, pct: 88 },
                    { name: 'Post Position', score: 24, max: 28, pct: 86 },
                    { name: 'Distance', score: 22, max: 24, pct: 92 },
                    { name: 'Surface', score: 20, max: 24, pct: 83 },
                    { name: 'Equipment', score: 16, max: 16, pct: 100 },
                    { name: 'Weight', score: 14, max: 16, pct: 88 },
                    { name: 'Recency', score: 10, max: 12, pct: 83 },
                    { name: 'Workouts', score: 8, max: 8, pct: 100 },
                  ].map((f) => (
                    <div key={f.name} className="ss-factor-row">
                      <span className="ss-factor-name">{f.name}</span>
                      <div className="ss-factor-bar-track">
                        <div
                          className="ss-factor-bar-fill"
                          style={{ width: `${f.pct}%` }}
                        />
                      </div>
                      <span className="ss-factor-score">
                        {f.score}/{f.max}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ss-s3-right">
              <div className="ss-callout">
                <div className="ss-callout-label">HOW SCORING WORKS</div>
                <div className="ss-callout-text">
                  Each of 15 categories has a weighted maximum. A horse's raw
                  performance in each area is converted to a score within that
                  weight.
                </div>
                <div className="ss-callout-text">
                  <b className="ss-teal">Speed (48 pts)</b> is the heaviest
                  factor. <b className="ss-teal">Equipment (16 pts)</b> the
                  lightest. The distribution reflects real predictive power from
                  historical data.
                </div>
              </div>
              <div className="ss-callout">
                <div className="ss-callout-label">WHAT TO LOOK FOR</div>
                <div className="ss-s3-tips">
                  <div className="ss-tip">
                    <span className="ss-tip-icon">●</span>
                    <span>
                      <b>90%+ across top factors</b> = elite contender
                    </span>
                  </div>
                  <div className="ss-tip">
                    <span className="ss-tip-icon ss-tip-icon--amber">●</span>
                    <span>
                      <b>One weak area</b> = exploitable angle
                    </span>
                  </div>
                  <div className="ss-tip">
                    <span className="ss-tip-icon ss-tip-icon--red">●</span>
                    <span>
                      <b>High score + high odds</b> = prime value play
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 4: Top Bets */}
        <div className={`ss-slide ${current === 4 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">TOP BETS</div>
          <h1 className="ss-title">Furlong surfaces the strongest plays.</h1>
          <p className="ss-subtitle">
            Ranked by edge percentage. These are the horses where the gap between
            public odds and fair odds is widest — your best opportunities.
          </p>

          <div className="ss-s4-grid">
            <div className="ss-s4-left">
              {[
                {
                  rank: 1,
                  name: 'Jeremy',
                  post: 1,
                  edge: '+67%',
                  odds: '5-2',
                  fair: '3-2',
                  score: 292,
                  reason: 'Highest raw score. Public sleeping on his speed + class combo.',
                },
                {
                  rank: 2,
                  name: 'Mattagio',
                  post: 2,
                  edge: '+40%',
                  odds: '7-2',
                  fair: '5-2',
                  score: 278,
                  reason: 'Strong form cycle at this distance. Jockey upgrade factored.',
                },
                {
                  rank: 3,
                  name: 'Nick',
                  post: 3,
                  edge: '+33%',
                  odds: '4-1',
                  fair: '3-1',
                  score: 265,
                  reason: 'Pace scenario sets up perfectly. Should get an easy lead.',
                },
                {
                  rank: 4,
                  name: 'Brock',
                  post: 5,
                  edge: '+33%',
                  odds: '8-1',
                  fair: '6-1',
                  score: 244,
                  reason: 'Longshot value. Same edge as #3 but at bigger odds.',
                },
                {
                  rank: 5,
                  name: 'Danny',
                  post: 9,
                  edge: '+33%',
                  odds: '20-1',
                  fair: '15-1',
                  score: 198,
                  reason: 'Bomb alert. Recent works undervalued. Live at a big price.',
                },
              ].map((b) => (
                <div
                  key={b.rank}
                  className={`ss-bet-card ${b.rank === 1 ? 'ss-bet-card--top' : ''}`}
                >
                  <div className="ss-bet-rank">#{b.rank}</div>
                  <div className="ss-bet-body">
                    <div className="ss-bet-name">
                      {b.name}{' '}
                      <span className="ss-bet-post">#{b.post}</span>
                    </div>
                    <div className="ss-bet-reason">{b.reason}</div>
                  </div>
                  <div className="ss-bet-stats">
                    <div className="ss-bet-edge">{b.edge}</div>
                    <div className="ss-bet-odds">
                      {b.odds} → {b.fair}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ss-s4-right">
              <div className="ss-callout">
                <div className="ss-callout-label">HOW BETS ARE RANKED</div>
                <div className="ss-callout-text">
                  Top Bets are sorted by <b className="ss-teal">edge %</b>.
                  This is the gap between what the crowd thinks a horse is worth
                  and what Furlong's model says. Bigger gap = bigger opportunity.
                </div>
              </div>
              <div className="ss-callout ss-callout--signal">
                <div className="ss-callout-label">THE VALUE SPECTRUM</div>
                <div className="ss-value-spectrum">
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--elite">+50%+</span>
                    <span>Elite — Rare. Strong conviction plays.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--good">+25-49%</span>
                    <span>Good — Solid edge. Core of your ticket.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--fair">+10-24%</span>
                    <span>Fair — Marginal edge. Exotic coverage only.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--bad">Negative</span>
                    <span>Overbet — Public overvalues. Fade these.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 5: Build My Ticket */}
        <div className={`ss-slide ${current === 5 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">BUILD MY TICKET</div>
          <h1 className="ss-title">Set a budget. Pick a mode. Get a ticket.</h1>
          <p className="ss-subtitle">
            Furlong allocates your bankroll across bet types using Kelly
            criterion — mathematically optimal position sizing.
          </p>

          <div className="ss-s5-grid">
            <div className="ss-s5-left">
              <div className="ss-ticket-mock">
                <div className="ss-ticket-header">
                  <span className="ss-ticket-title">YOUR TICKET</span>
                  <span className="ss-ticket-budget">Budget: $50</span>
                </div>
                <div className="ss-ticket-mode">
                  <span className="ss-ticket-mode-label">MODE:</span>
                  <span className="ss-ticket-mode-val">BALANCED</span>
                </div>
                <div className="ss-ticket-bets">
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">WIN</span>
                    <span className="ss-ticket-bet-detail">
                      $10 WIN on #1 Jeremy
                    </span>
                    <span className="ss-ticket-bet-amount">$10</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">WIN</span>
                    <span className="ss-ticket-bet-detail">
                      $5 WIN on #2 Mattagio
                    </span>
                    <span className="ss-ticket-bet-amount">$5</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">EXACTA</span>
                    <span className="ss-ticket-bet-detail">
                      $2 EXACTA BOX 1-2-3
                    </span>
                    <span className="ss-ticket-bet-amount">$12</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">TRIFECTA</span>
                    <span className="ss-ticket-bet-detail">
                      $1 TRI BOX 1-2-3-5
                    </span>
                    <span className="ss-ticket-bet-amount">$24</span>
                  </div>
                </div>
                <div className="ss-ticket-total">
                  <span>TOTAL</span>
                  <span>$51</span>
                </div>
              </div>
            </div>

            <div className="ss-s5-right">
              <div className="ss-callout">
                <div className="ss-callout-label">RISK MODES</div>
                <div className="ss-mode-list">
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-green">CONSERVATIVE</span>
                    <span className="ss-mode-desc">
                      Heavy on Win/Place. Minimal exotics. Lower variance.
                    </span>
                  </div>
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-teal">BALANCED</span>
                    <span className="ss-mode-desc">
                      Mix of straight and exotic bets. Best for most users.
                    </span>
                  </div>
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-amber">AGGRESSIVE</span>
                    <span className="ss-mode-desc">
                      Exotic-heavy. Bigger payouts, higher risk. Longshots
                      included.
                    </span>
                  </div>
                </div>
              </div>
              <div className="ss-callout">
                <div className="ss-callout-label">KELLY CRITERION</div>
                <div className="ss-callout-text">
                  Position sizing based on edge strength. Bigger edge = bigger
                  allocation. No guesswork — pure math determines how much goes
                  on each bet.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 6: Win / Place / Show */}
        <div className={`ss-slide ${current === 6 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">WIN / PLACE / SHOW</div>
          <h1 className="ss-title">The building blocks of every ticket.</h1>
          <p className="ss-subtitle">
            Straight bets are the foundation. Understand these before moving to
            exotics.
          </p>

          <div className="ss-s6-grid">
            <div className="ss-wps-card ss-wps-card--win">
              <div className="ss-wps-badge">W</div>
              <div className="ss-wps-type">WIN</div>
              <div className="ss-wps-rule">Your horse finishes 1st.</div>
              <div className="ss-wps-example">
                $5 WIN on #1 Jeremy at 5-2
              </div>
              <div className="ss-wps-payout">
                Pays: $5 × 2.5 = <b>$12.50</b>
              </div>
              <div className="ss-wps-note">Highest payout. Hardest to hit.</div>
            </div>

            <div className="ss-wps-card ss-wps-card--place">
              <div className="ss-wps-badge ss-wps-badge--place">P</div>
              <div className="ss-wps-type">PLACE</div>
              <div className="ss-wps-rule">Your horse finishes 1st or 2nd.</div>
              <div className="ss-wps-example">
                $5 PLACE on #1 Jeremy
              </div>
              <div className="ss-wps-payout">
                Pays: roughly <b>half of win</b> payout
              </div>
              <div className="ss-wps-note">
                Two ways to cash. Lower payout than Win.
              </div>
            </div>

            <div className="ss-wps-card ss-wps-card--show">
              <div className="ss-wps-badge ss-wps-badge--show">S</div>
              <div className="ss-wps-type">SHOW</div>
              <div className="ss-wps-rule">
                Your horse finishes 1st, 2nd, or 3rd.
              </div>
              <div className="ss-wps-example">
                $5 SHOW on #1 Jeremy
              </div>
              <div className="ss-wps-payout">
                Pays: roughly <b>1/3 of win</b> payout
              </div>
              <div className="ss-wps-note">
                Easiest to cash. Smallest payout.
              </div>
            </div>
          </div>

          <div className="ss-s6-tip">
            <b>Pro Tip:</b> Furlong builds Win-heavy tickets because value is
            maximized when you're right on the winner. Place/Show is safety net,
            not strategy.
          </div>
        </div>

        {/* SLIDE 7: Exotics */}
        <div className={`ss-slide ${current === 7 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">EXOTIC BETS</div>
          <h1 className="ss-title">Where the real money is made.</h1>
          <p className="ss-subtitle">
            Exotics combine multiple horses into a single bet for massive payouts.
            Furlong handles the math.
          </p>

          <div className="ss-s7-grid">
            <div className="ss-exotic-card">
              <div className="ss-exotic-header">EXACTA</div>
              <div className="ss-exotic-rule">
                Pick 1st and 2nd place finishers.
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">STRAIGHT</span>
                  <span className="ss-exotic-v-desc">
                    Exact order. $2 EXACTA — Nick over Casey
                  </span>
                </div>
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX</span>
                  <span className="ss-exotic-v-desc">
                    Either order. $2 EXACTA BOX — Nick + Casey = $4
                  </span>
                </div>
              </div>
            </div>

            <div className="ss-exotic-card">
              <div className="ss-exotic-header">TRIFECTA</div>
              <div className="ss-exotic-rule">
                Pick 1st, 2nd, and 3rd place.
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">STRAIGHT</span>
                  <span className="ss-exotic-v-desc">
                    Exact order. $1 TRI — Nick, Casey, Roger
                  </span>
                </div>
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX</span>
                  <span className="ss-exotic-v-desc">
                    Any order. Box 3: $6 · Box 4: $24 · Box 5: $60
                  </span>
                </div>
              </div>
            </div>

            <div className="ss-exotic-card">
              <div className="ss-exotic-header">SUPERFECTA</div>
              <div className="ss-exotic-rule">
                Pick 1st through 4th place.
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX COSTS</span>
                  <span className="ss-exotic-v-desc">
                    Box 4: $24 · Box 5: $120 · Box 6: $360
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="ss-s7-tips">
            <span>BOX = coverage, STRAIGHT = precision</span>
            <span>More horses = more combos = more cost</span>
            <span>Build My Ticket handles the math</span>
          </div>
        </div>

        {/* SLIDE 8: At the Window */}
        <div className={`ss-slide ${current === 8 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">AT THE WINDOW</div>
          <h1 className="ss-title">
            Furlong writes the script. You just read it.
          </h1>
          <p className="ss-subtitle">
            No memorization. No mental math. Just read the box.
          </p>

          <div className="ss-s8-window">
            <div className="ss-s8-say-label">SAY AT THE WINDOW</div>
            <div className="ss-s8-say-text">$3 TRIFECTA BOX, 4-7-2</div>
          </div>
          <div className="ss-s8-translation">
            "Three dollar Trifecta Box — horses four, seven, two — any order."
          </div>

          <div className="ss-s8-breakdown">
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE AMOUNT</div>
              <div className="ss-s8-part-value">$3</div>
              <div className="ss-s8-part-desc">
                Base bet per combination. Calculated from your budget.
              </div>
            </div>
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE BET TYPE</div>
              <div className="ss-s8-part-value ss-s8-part-value--sm">
                TRIFECTA BOX
              </div>
              <div className="ss-s8-part-desc">
                Boxed = any order. Straight = exact order.
              </div>
            </div>
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE HORSES</div>
              <div className="ss-s8-part-value">4-7-2</div>
              <div className="ss-s8-part-desc">
                Program numbers. Match exactly when ordering.
              </div>
            </div>
          </div>

          <div className="ss-s8-scripts-label">Common Window Scripts</div>
          <div className="ss-s8-scripts">
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">$5 WIN on number 3</span>
              <span className="ss-s8-script-spoken">
                "Five dollar win bet on horse number three"
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">$2 EXACTA BOX, 1-4</span>
              <span className="ss-s8-script-spoken">
                "Two dollar exacta box, horses one and four"
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">$1 TRIFECTA BOX, 3-7-5-2</span>
              <span className="ss-s8-script-spoken">
                "One dollar trifecta box, four horses, any order"
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">$1 SUPER BOX, 2-4-6-8</span>
              <span className="ss-s8-script-spoken">
                "One dollar superfecta box, four horses"
              </span>
            </div>
          </div>

          <div className="ss-s8-final">
            You built it. Furlong wrote it. Now go cash it.
          </div>
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="ss-bottombar" onClick={(e) => e.stopPropagation()}>
        {current > 1 && (
          <button className="ss-btn-back" onClick={back}>
            ← BACK
          </button>
        )}
        <div className="ss-nav-mid">
          <span className="ss-counter">
            {current} / {TOTAL_SLIDES}
          </span>
          <div className="ss-dots">
            {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
              <div
                key={i}
                className={`ss-dot ${
                  i === current - 1
                    ? 'ss-dot--active'
                    : i < current - 1
                      ? 'ss-dot--done'
                      : ''
                }`}
              />
            ))}
          </div>
        </div>
        <button className="ss-btn-next" onClick={forward}>
          {current === TOTAL_SLIDES ? 'FINISH ✓' : 'NEXT →'}
        </button>
      </footer>
    </div>
  );
}
