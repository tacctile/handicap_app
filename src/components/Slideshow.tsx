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

      <main className="ss-deck" onClick={forward}>
        {showRestart && (
          <div className="ss-restart">
            <div className="ss-restart-check">✓</div>
            <h2>You're all set</h2>
            <p>Restarting…</p>
          </div>
        )}

        {/* ============ SLIDE 1: What is Furlong? ============ */}
        <div className={`ss-slide ${current === 1 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">WHAT IS FURLONG?</div>
          <h1 className="ss-title">Your personal horse racing assistant.</h1>
          <p className="ss-subtitle">
            Think of it like this: at a horse race, everyone is guessing which
            horse will win. Furlong does the homework for you — it studies every
            horse, grades them like a report card, and tells you which ones are
            the best deals. Then it writes your betting slip so you know exactly
            what to say at the window.
          </p>

          <div className="ss-s1-grid">
            <div className="ss-s1-left">
              <div className="ss-s1-hero">
                Everyone at the track is guessing.
                <br />
                Furlong is doing <em className="ss-em-teal">math</em>.
              </div>
              <p className="ss-s1-desc">
                Imagine a store where every item is priced by other shoppers.
                Sometimes they price a $100 jacket at $40 — that's a steal.
                Furlong finds those "steals" at the horse track.
                When the crowd prices a horse wrong, Furlong spots it.
              </p>

              <div className="ss-rank-header">HOW WE COMPARE TO THE COMPETITION</div>
              <div className="ss-rank-list">
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">1</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      Ragozin / Thoro-Graph{' '}
                      <span className="ss-rank-tag ss-rank-tag--above">30+ YRS</span>
                    </div>
                    <div className="ss-rank-desc">
                      The grandfathers of horse data. They've been doing this for
                      30+ years. But they only give you raw numbers — you still
                      have to figure out what to bet on your own. It takes years
                      to learn how to use their sheets.
                    </div>
                  </div>
                </div>
                <div className="ss-rank-item">
                  <div className="ss-rank-pos">2</div>
                  <div className="ss-rank-body">
                    <div className="ss-rank-name">
                      TimeformUS{' '}
                      <span className="ss-rank-tag ss-rank-tag--above">PRO TOOL</span>
                    </div>
                    <div className="ss-rank-desc">
                      The industry's most trusted speed ratings. Professional
                      handicappers swear by them. But again — they just hand you
                      data. No recommendations, no betting advice, no ticket.
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
                      The biggest database of horse history. Like having a library
                      with every book — but no librarian to tell you which one to
                      read. You have to do ALL the work yourself.
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
                      <span className="ss-rank-tag ss-rank-tag--us">ALL-IN-ONE</span>
                    </div>
                    <div className="ss-rank-desc">
                      The only platform that does everything: grades the horses,
                      finds the best deals, builds your ticket, AND tells you
                      exactly what to say at the window. 100% offline — works
                      right at the track with no wifi needed.
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
                      They give you a pile of numbers and say "good luck." No
                      scoring, no recommendations, no help with what to bet.
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
                      Pay someone to tell you who to bet on — but they'll never
                      explain why. Like a waiter who just says "trust me" but
                      won't show you the menu.
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
                      The bare minimum. Like using a free calculator app when you
                      need an accountant. Basic tips that everyone else already has.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ss-s1-right">
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--teal" />
                <div>
                  <div className="ss-feat-title">Report Card for Every Horse</div>
                  <div className="ss-feat-desc">
                    Think of it like grading a student on math, reading, science,
                    and more — then adding it all up. Each horse gets graded on
                    15 different things like speed, stamina, and who's riding them.
                    The higher the score, the better the horse looks on paper.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--green" />
                <div>
                  <div className="ss-feat-title">Finds the Best Deals</div>
                  <div className="ss-feat-desc">
                    Imagine a toy is worth $10 but the store is selling it for $5
                    — that's a steal. Furlong compares what a horse SHOULD be
                    priced at versus what the crowd is paying. When there's a gap,
                    that's your opportunity.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--amber" />
                <div>
                  <div className="ss-feat-title">Builds Your Betting Slip</div>
                  <div className="ss-feat-desc">
                    Tell Furlong how much you want to spend (say, $50). It figures
                    out exactly which bets to make and how much to put on each one
                    — like a financial advisor for horse racing. Every ticket comes
                    with word-for-word instructions for the window.
                  </div>
                </div>
              </div>
              <div className="ss-feat-card">
                <span className="ss-feat-dot ss-feat-dot--purple" />
                <div>
                  <div className="ss-feat-title">Works Without Wifi</div>
                  <div className="ss-feat-desc">
                    Most horse tracks have terrible wifi. Furlong runs entirely on
                    your device — no internet needed, no subscriptions, no server
                    calls. Load your race data once and you're good for the whole
                    day, even in the middle of nowhere.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 2: The Race Screen ============ */}
        <div className={`ss-slide ${current === 2 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">THE RACE SCREEN</div>
          <h1 className="ss-title">Every horse, graded and compared.</h1>
          <p className="ss-subtitle">
            This is the main screen you'll use. Think of it like a classroom
            where every student (horse) just got their test back. You can see
            everyone's grade at a glance, and more importantly — who's a
            better deal than people realize.
          </p>

          <div className="ss-s2-grid">
            <div className="ss-s2-left">
              <div className="ss-table">
                <div className="ss-table-head">
                  <span>#</span>
                  <span>HORSE</span>
                  <span>GRADE</span>
                  <span>PRICE</span>
                  <span>TRUE VALUE</span>
                  <span>DEAL?</span>
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
                <div className="ss-callout-label">WHAT EACH COLUMN MEANS</div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">GRADE</span>
                  <span>
                    The horse's test score out of 336. Like a GPA — higher is
                    better. Built from 15 different categories.
                  </span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">PRICE</span>
                  <span>
                    What the crowd thinks this horse is worth. This is set by
                    everyone else's bets — like supply and demand.
                  </span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key">TRUE VALUE</span>
                  <span>
                    What Furlong's math says the horse is ACTUALLY worth. When this
                    is lower than the Price, you've found a deal.
                  </span>
                </div>
                <div className="ss-callout-item">
                  <span className="ss-callout-key ss-callout-key--edge">DEAL?</span>
                  <span>
                    The money question. <b className="ss-green">Green = good deal</b>
                    {' '}(you're getting more than you're paying for).{' '}
                    <b className="ss-red">Red = bad deal</b> (overpriced).
                  </span>
                </div>
              </div>
              <div className="ss-callout ss-callout--signal">
                <div className="ss-callout-label">REAL EXAMPLE FROM THIS RACE</div>
                <p className="ss-callout-text">
                  <b className="ss-teal">Jeremy</b> — The crowd priced him at 5-2,
                  but Furlong's math says he's really a 3-2 horse. That's like
                  finding a <b className="ss-green">$100 jacket on sale for $60</b>.
                  He's the best deal in the race.
                </p>
                <p className="ss-callout-text">
                  <b className="ss-teal">Roger</b> — Priced at 6-1, but Furlong
                  says he's really an 8-1 horse. That's like paying{' '}
                  <b className="ss-red">$100 for something worth $75</b>.
                  The crowd likes him too much. Skip him.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 3: The Report Card ============ */}
        <div className={`ss-slide ${current === 3 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">THE REPORT CARD</div>
          <h1 className="ss-title">See exactly why a horse scored high or low.</h1>
          <p className="ss-subtitle">
            Tap any horse's name to open their full report card. Think of it like
            a student's grades broken down by subject — you can see exactly where
            they're strong and where they're weak. No secrets, no guessing.
          </p>

          <div className="ss-s3-grid">
            <div className="ss-horse-card">
              <div className="ss-hc-header">
                <div className="ss-hc-post">1</div>
                <div className="ss-hc-info">
                  <div className="ss-hc-name">Jeremy</div>
                  <div className="ss-hc-detail">
                    Jockey: J. Castellano · Trainer: T. Pletcher
                  </div>
                </div>
                <div className="ss-hc-score">
                  <div className="ss-hc-score-num">292</div>
                  <div className="ss-hc-score-label">out of 336</div>
                </div>
              </div>

              <div className="ss-hc-factors">
                <div className="ss-hc-section-label">SUBJECTS ON THE REPORT CARD</div>
                <div className="ss-factor-grid">
                  {[
                    { name: 'Speed', desc: 'How fast the horse runs', score: 44, max: 48, pct: 92 },
                    { name: 'Class', desc: 'Level of competition faced', score: 40, max: 44, pct: 91 },
                    { name: 'Form', desc: 'How well they\'ve been running lately', score: 36, max: 40, pct: 90 },
                    { name: 'Connections', desc: 'Quality of jockey + trainer', score: 28, max: 32, pct: 88 },
                    { name: 'Post', desc: 'Starting lane advantage', score: 24, max: 28, pct: 86 },
                    { name: 'Pace', desc: 'Running style vs. race setup', score: 30, max: 36, pct: 83 },
                    { name: 'Distance', desc: 'Track record at this length', score: 22, max: 24, pct: 92 },
                    { name: 'Surface', desc: 'Dirt vs. turf preference', score: 20, max: 24, pct: 83 },
                  ].map((f) => (
                    <div key={f.name} className="ss-factor-row">
                      <div className="ss-factor-info">
                        <span className="ss-factor-name">{f.name}</span>
                        <span className="ss-factor-desc">{f.desc}</span>
                      </div>
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
                <div className="ss-callout-label">HOW TO READ THIS</div>
                <div className="ss-callout-text">
                  Each teal bar is like a fuel gauge. A full bar means the horse
                  scored close to perfect in that category. A bar that only fills
                  halfway means they scored about average. <b>The further the bar
                  fills, the better.</b>
                </div>
                <div className="ss-callout-text">
                  <b className="ss-teal">Speed</b> is worth the most points (48)
                  because it's the strongest predictor of who wins. It's like how
                  math and reading are weighted more than art class on a GPA.
                </div>
              </div>
              <div className="ss-callout">
                <div className="ss-callout-label">WHAT TO LOOK FOR</div>
                <div className="ss-s3-tips">
                  <div className="ss-tip">
                    <span className="ss-tip-icon">●</span>
                    <span>
                      <b>All bars nearly full?</b> That's an A+ student — strong
                      everywhere, hard to beat.
                    </span>
                  </div>
                  <div className="ss-tip">
                    <span className="ss-tip-icon ss-tip-icon--amber">●</span>
                    <span>
                      <b>One short bar?</b> That's their weak spot. Like a
                      student who aces everything but struggles in math.
                    </span>
                  </div>
                  <div className="ss-tip">
                    <span className="ss-tip-icon ss-tip-icon--red">●</span>
                    <span>
                      <b>High score but high odds?</b> That's the jackpot — a
                      smart horse the crowd is overlooking. Like finding a
                      4.0 student that nobody recruited.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 4: Best Bets ============ */}
        <div className={`ss-slide ${current === 4 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">BEST BETS</div>
          <h1 className="ss-title">The horses where your money goes furthest.</h1>
          <p className="ss-subtitle">
            Furlong ranks every horse by how good of a "deal" they are. These are
            the top 5 — the ones where the crowd is most wrong and you have the
            biggest advantage. Think of it like a sale rack — these are the best
            discounts.
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
                  reason: 'Best overall grade in the race. The crowd hasn\'t caught on to how good he really is. Like a top draft pick being undervalued.',
                },
                {
                  rank: 2,
                  name: 'Mattagio',
                  post: 2,
                  edge: '+40%',
                  odds: '7-2',
                  fair: '5-2',
                  reason: 'Has been running great lately and just got a better jockey. The crowd hasn\'t adjusted his price yet.',
                },
                {
                  rank: 3,
                  name: 'Nick',
                  post: 3,
                  edge: '+33%',
                  odds: '4-1',
                  fair: '3-1',
                  reason: 'The way this race sets up, Nick gets to run his style without anyone bothering him. It\'s like getting a head start.',
                },
                {
                  rank: 4,
                  name: 'Brock',
                  post: 5,
                  edge: '+33%',
                  odds: '8-1',
                  fair: '6-1',
                  reason: 'Same deal percentage as Nick, but at 8-1 he pays way more if he wins. Higher risk, bigger reward.',
                },
                {
                  rank: 5,
                  name: 'Danny',
                  post: 9,
                  edge: '+33%',
                  odds: '20-1',
                  fair: '15-1',
                  reason: 'The longshot special. Nobody is paying attention to him, but his recent practice runs say he\'s live. A small bet here could pay big.',
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
                <div className="ss-callout-label">WHAT "DEAL %" MEANS</div>
                <div className="ss-callout-text">
                  It's the gap between what you're paying and what the horse is
                  actually worth. A <b className="ss-green">+67% deal</b> on Jeremy
                  means you're getting a horse worth $167 for $100.
                  It's like using a 40%-off coupon — same product, less money.
                </div>
              </div>
              <div className="ss-callout ss-callout--signal">
                <div className="ss-callout-label">HOW GOOD IS THE DEAL?</div>
                <div className="ss-value-spectrum">
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--elite">+50%+</span>
                    <span>Amazing deal. Like 50% off at a store. Rare — bet with confidence.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--good">+25-49%</span>
                    <span>Good deal. Like a solid sale. These are the core of your ticket.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--fair">+10-24%</span>
                    <span>Okay deal. Small discount. Worth including in bigger bets.</span>
                  </div>
                  <div className="ss-vs-row">
                    <span className="ss-vs-badge ss-vs-badge--bad">Negative</span>
                    <span>Bad deal. You're overpaying. Like buying full price when it's overpriced. Avoid.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 5: Build My Ticket ============ */}
        <div className={`ss-slide ${current === 5 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">BUILD MY TICKET</div>
          <h1 className="ss-title">Tell Furlong your budget. It does the rest.</h1>
          <p className="ss-subtitle">
            This is like having a financial advisor at the track. You say "I want
            to spend $50 today." Furlong splits that money across different bets
            — putting more on the best deals and less on the riskier ones. You
            don't have to do any math.
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
                      $10 on Jeremy to finish 1st
                    </span>
                    <span className="ss-ticket-bet-amount">$10</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">WIN</span>
                    <span className="ss-ticket-bet-detail">
                      $5 on Mattagio to finish 1st
                    </span>
                    <span className="ss-ticket-bet-amount">$5</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">EXACTA</span>
                    <span className="ss-ticket-bet-detail">
                      Jeremy + Mattagio + Nick finish 1st & 2nd (any order)
                    </span>
                    <span className="ss-ticket-bet-amount">$12</span>
                  </div>
                  <div className="ss-ticket-bet">
                    <span className="ss-ticket-bet-type">TRIFECTA</span>
                    <span className="ss-ticket-bet-detail">
                      Jeremy, Mattagio, Nick, Brock finish top 3 (any order)
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
                <div className="ss-callout-label">PICK YOUR COMFORT LEVEL</div>
                <div className="ss-mode-list">
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-green">CONSERVATIVE</span>
                    <span className="ss-mode-desc">
                      "I want to cash something today." Focuses on safer bets.
                      Like ordering the reliable dish at a restaurant — less
                      exciting, but you know you'll be happy.
                    </span>
                  </div>
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-teal">BALANCED</span>
                    <span className="ss-mode-desc">
                      "Mix of safe and exciting." A little bit of everything.
                      Best for most people. Like a diversified playlist — some
                      hits you know, some new discoveries.
                    </span>
                  </div>
                  <div className="ss-mode-item">
                    <span className="ss-mode-name ss-amber">AGGRESSIVE</span>
                    <span className="ss-mode-desc">
                      "I'm here for a big payday." Focuses on exotic bets that
                      pay more but are harder to hit. Like buying a lottery
                      ticket — if it hits, it hits BIG.
                    </span>
                  </div>
                </div>
              </div>
              <div className="ss-callout">
                <div className="ss-callout-label">WHY TRUST THE MATH?</div>
                <div className="ss-callout-text">
                  Furlong uses a formula called the <b className="ss-teal">Kelly
                  Criterion</b> — the same math Wall Street uses to size
                  investments. The idea is simple: bet more when you have a bigger
                  advantage, bet less when the advantage is small. No gut feelings,
                  no guessing — just math.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 6: Types of Bets (Simple) ============ */}
        <div className={`ss-slide ${current === 6 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">TYPES OF BETS — THE BASICS</div>
          <h1 className="ss-title">Three simple bets everyone should know.</h1>
          <p className="ss-subtitle">
            These are the easiest bets to understand. You're just picking ONE
            horse and saying how confident you are that they'll finish near the
            top. Think of it like a test with three difficulty levels — the
            harder the test, the bigger the reward.
          </p>

          <div className="ss-s6-grid">
            <div className="ss-wps-card ss-wps-card--win">
              <div className="ss-wps-badge">W</div>
              <div className="ss-wps-type">WIN</div>
              <div className="ss-wps-rule">
                Your horse has to come in <b>1st place</b>. That's it.
              </div>
              <div className="ss-wps-example">
                "I bet $5 that Jeremy finishes 1st."
              </div>
              <div className="ss-wps-payout">
                If he wins at 5-2 odds, you get back{' '}
                <b className="ss-green">$17.50</b>
                {' '}(your $5 bet + $12.50 profit).
              </div>
              <div className="ss-wps-note">
                Hardest to win, but pays the most. Like betting your friend $5
                that you'll get an A on the test — hard, but the payout is worth it.
              </div>
            </div>

            <div className="ss-wps-card ss-wps-card--place">
              <div className="ss-wps-badge ss-wps-badge--place">P</div>
              <div className="ss-wps-type">PLACE</div>
              <div className="ss-wps-rule">
                Your horse finishes <b>1st or 2nd</b>. Two chances to win.
              </div>
              <div className="ss-wps-example">
                "I bet $5 that Jeremy finishes in the top 2."
              </div>
              <div className="ss-wps-payout">
                Pays roughly <b className="ss-teal">half</b> of what a Win bet
                would pay — but you have two shots at cashing.
              </div>
              <div className="ss-wps-note">
                The safe middle ground. Like saying "I'll bet you I get an A or a
                B" — easier to hit, smaller payout.
              </div>
            </div>

            <div className="ss-wps-card ss-wps-card--show">
              <div className="ss-wps-badge ss-wps-badge--show">S</div>
              <div className="ss-wps-type">SHOW</div>
              <div className="ss-wps-rule">
                Your horse finishes <b>1st, 2nd, or 3rd</b>. Three chances to win.
              </div>
              <div className="ss-wps-example">
                "I bet $5 that Jeremy finishes in the top 3."
              </div>
              <div className="ss-wps-payout">
                Pays about <b className="ss-amber">a third</b> of what Win pays —
                but the easiest bet to cash.
              </div>
              <div className="ss-wps-note">
                The training wheels bet. Great for your first day. Like saying
                "I'll bet you I pass the test" — almost guaranteed.
              </div>
            </div>
          </div>
        </div>

        {/* ============ SLIDE 7: Exotic Bets ============ */}
        <div className={`ss-slide ${current === 7 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">TYPES OF BETS — THE BIG PAYOUTS</div>
          <h1 className="ss-title">Combine horses for massive payoffs.</h1>
          <p className="ss-subtitle">
            These bets are harder to hit because you're picking MULTIPLE horses
            and the order they finish. But when they hit, they pay 10x, 50x, even
            100x your bet. Think of it like a parlay in football — more picks
            means harder to win, but way more money.
          </p>

          <div className="ss-s7-grid">
            <div className="ss-exotic-card">
              <div className="ss-exotic-header">EXACTA</div>
              <div className="ss-exotic-rule">
                Pick the horses that finish <b>1st AND 2nd</b>.
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">STRAIGHT</span>
                  <span className="ss-exotic-v-desc">
                    You pick the exact order: "Nick wins, Casey is 2nd."
                    Harder, pays more. Cost: $2.
                  </span>
                </div>
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX</span>
                  <span className="ss-exotic-v-desc">
                    Either order works: "Nick and Casey finish 1st and 2nd, I
                    don't care which one wins." Easier, costs double ($4).
                  </span>
                </div>
              </div>
            </div>

            <div className="ss-exotic-card">
              <div className="ss-exotic-header">TRIFECTA</div>
              <div className="ss-exotic-rule">
                Pick the horses that finish <b>1st, 2nd, AND 3rd</b>.
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">STRAIGHT</span>
                  <span className="ss-exotic-v-desc">
                    Exact order: "Nick wins, Casey 2nd, Roger 3rd."
                    Very hard, very big payout. Cost: $1.
                  </span>
                </div>
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX</span>
                  <span className="ss-exotic-v-desc">
                    Any order works. Box 3 horses = $6. Box 4 = $24.
                    Box 5 = $60. More horses = more coverage = more cost.
                  </span>
                </div>
              </div>
            </div>

            <div className="ss-exotic-card">
              <div className="ss-exotic-header">SUPERFECTA</div>
              <div className="ss-exotic-rule">
                Pick 1st through 4th. <b>The hardest — and biggest payout.</b>
              </div>
              <div className="ss-exotic-variants">
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">THE PAYOFF</span>
                  <span className="ss-exotic-v-desc">
                    Can pay $500, $1,000, even $10,000+ on a $1 bet. It's
                    the lottery ticket of horse racing. Furlong figures out
                    the best combinations for you.
                  </span>
                </div>
                <div className="ss-exotic-v">
                  <span className="ss-exotic-v-type">BOX COST</span>
                  <span className="ss-exotic-v-desc">
                    4 horses: $24 · 5 horses: $120 · 6 horses: $360
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="ss-s7-tips">
            <span><b>BOX</b> = "any order" (easier, costs more)</span>
            <span><b>STRAIGHT</b> = "exact order" (harder, costs less)</span>
            <span><b>Furlong calculates everything for you</b></span>
          </div>
        </div>

        {/* ============ SLIDE 8: At the Window ============ */}
        <div className={`ss-slide ${current === 8 ? 'ss-slide--active' : ''}`}>
          <div className="ss-label">AT THE BETTING WINDOW</div>
          <h1 className="ss-title">
            Just read what Furlong wrote. That's it.
          </h1>
          <p className="ss-subtitle">
            This is the part people worry about most — walking up to the window
            and actually placing the bet. Don't stress. Furlong gives you the
            exact words to say, like a script. You literally just read it out loud.
          </p>

          <div className="ss-s8-window">
            <div className="ss-s8-say-label">WALK UP AND SAY THIS</div>
            <div className="ss-s8-say-text">$3 TRIFECTA BOX, 4-7-2</div>
          </div>
          <div className="ss-s8-translation">
            That's it. You just said: "I want to bet $3 that horses 4, 7, and 2
            finish in the top 3 — in any order."
          </div>

          <div className="ss-s8-breakdown">
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE DOLLAR AMOUNT</div>
              <div className="ss-s8-part-value">$3</div>
              <div className="ss-s8-part-desc">
                How much you're betting. Furlong calculates this from your budget.
              </div>
            </div>
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE BET TYPE</div>
              <div className="ss-s8-part-value ss-s8-part-value--sm">
                TRIFECTA BOX
              </div>
              <div className="ss-s8-part-desc">
                The kind of bet. "Trifecta" means top 3. "Box" means any order.
              </div>
            </div>
            <div className="ss-s8-part">
              <div className="ss-s8-part-label">THE HORSE NUMBERS</div>
              <div className="ss-s8-part-value">4-7-2</div>
              <div className="ss-s8-part-desc">
                Each horse wears a number. Just read the numbers from the ticket.
              </div>
            </div>
          </div>

          <div className="ss-s8-scripts-label">MORE EXAMPLES — JUST READ THESE OUT LOUD</div>
          <div className="ss-s8-scripts">
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">"$5 Win on number 3"</span>
              <span className="ss-s8-script-spoken">
                You're betting $5 that horse #3 wins the race.
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">"$2 Exacta Box, 1 and 4"</span>
              <span className="ss-s8-script-spoken">
                You're betting $4 total that horses #1 and #4 finish 1st and 2nd.
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">"$1 Trifecta Box, 3-7-5-2"</span>
              <span className="ss-s8-script-spoken">
                You're betting $24 that any 3 of those 4 horses finish in the top 3.
              </span>
            </div>
            <div className="ss-s8-script">
              <span className="ss-s8-script-say">"$1 Superfecta Box, 2-4-6-8"</span>
              <span className="ss-s8-script-spoken">
                You're betting $24 that those 4 horses finish 1st through 4th.
              </span>
            </div>
          </div>

          <div className="ss-s8-final">
            Furlong studied the horses. Built your ticket. Wrote your script.
            <br />
            All you have to do is show up and read it.
          </div>
        </div>
      </main>

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
