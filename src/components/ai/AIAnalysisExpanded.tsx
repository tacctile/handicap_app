/**
 * AIAnalysisExpanded Component
 *
 * Displays the full AI analysis when expanded.
 * Shows bot findings, template recommendation, key horses, and betting implications.
 */

import React from 'react';
import type { AIRaceAnalysis, BotStatusInfo } from '../../services/ai/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAnalysisExpandedProps {
  /** AI analysis result */
  analysis: AIRaceAnalysis;
  /** Race number for display context */
  raceNumber: number;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  padding: 'var(--space-4)',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
  maxHeight: '400px',
  overflowY: 'auto',
};

const sectionStyles: React.CSSProperties = {
  marginBottom: 'var(--space-4)',
};

const lastSectionStyles: React.CSSProperties = {
  marginBottom: 0,
};

const sectionHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  marginBottom: 'var(--space-2)',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'],
  color: 'var(--text-primary)',
};

const sectionIconStyles: React.CSSProperties = {
  fontSize: '16px',
  color: 'var(--text-tertiary)',
};

const sectionContentStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
};

const cardStyles: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3)',
  marginBottom: 'var(--space-3)',
  border: '1px solid var(--border-subtle)',
};

const narrativeStyles: React.CSSProperties = {
  ...cardStyles,
  fontStyle: 'italic',
  color: 'var(--text-secondary)',
};

const templateBadgeBaseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'],
};

const keyHorseRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-subtle)',
};

const lastKeyHorseRowStyles: React.CSSProperties = {
  ...keyHorseRowStyles,
  borderBottom: 'none',
};

const horseNumberStyles: React.CSSProperties = {
  fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'],
  color: 'var(--primary)',
  minWidth: '32px',
};

const horseNameStyles: React.CSSProperties = {
  flex: 1,
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
};

const horseLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-tertiary)',
};

const botGridStyles: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--space-3)',
};

const botCardStyles: React.CSSProperties = {
  ...cardStyles,
  marginBottom: 0,
};

const botHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-2)',
};

const botNameStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'],
  color: 'var(--text-primary)',
};

const botStatusStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
};

const botSuccessStyles: React.CSSProperties = {
  ...botStatusStyles,
  backgroundColor: 'rgba(16, 185, 129, 0.1)',
  color: 'var(--status-success)',
};

const botFailStyles: React.CSSProperties = {
  ...botStatusStyles,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--status-error)',
};

const botSummaryStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
};

const flagRowStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  marginTop: 'var(--space-2)',
};

const flagBadgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)',
};

const warningFlagStyles: React.CSSProperties = {
  ...flagBadgeStyles,
  backgroundColor: 'rgba(245, 158, 11, 0.1)',
  color: 'var(--status-warning)',
};

const infoFlagStyles: React.CSSProperties = {
  ...flagBadgeStyles,
  backgroundColor: 'rgba(25, 171, 181, 0.1)',
  color: 'var(--primary)',
};

const dangerFlagStyles: React.CSSProperties = {
  ...flagBadgeStyles,
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--status-error)',
};

const verdictCardStyles: React.CSSProperties = {
  ...cardStyles,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const verdictBetStyles: React.CSSProperties = {
  ...verdictCardStyles,
  borderColor: 'var(--status-success)',
  backgroundColor: 'rgba(16, 185, 129, 0.05)',
};

const verdictPassStyles: React.CSSProperties = {
  ...verdictCardStyles,
  borderColor: 'var(--status-warning)',
  backgroundColor: 'rgba(245, 158, 11, 0.05)',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get template badge styling based on template type
 */
function getTemplateBadgeStyles(template: string): React.CSSProperties {
  switch (template) {
    case 'A':
      return {
        ...templateBadgeBaseStyles,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        color: 'var(--status-success)',
      };
    case 'B':
      return {
        ...templateBadgeBaseStyles,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        color: 'var(--status-warning)',
      };
    case 'C':
      return {
        ...templateBadgeBaseStyles,
        backgroundColor: 'rgba(25, 171, 181, 0.1)',
        color: 'var(--primary)',
      };
    case 'PASS':
    default:
      return {
        ...templateBadgeBaseStyles,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: 'var(--status-error)',
      };
  }
}

/**
 * Get bot icon based on bot name
 */
function getBotIcon(botName: string): string {
  switch (botName.toLowerCase()) {
    case 'trip trouble':
      return 'warning';
    case 'pace scenario':
      return 'speed';
    case 'vulnerable favorite':
      return 'trending_down';
    case 'field spread':
      return 'groups';
    case 'class drop':
      return 'arrow_downward';
    default:
      return 'psychology';
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface BotSectionProps {
  botInfo: BotStatusInfo;
  icon: string;
}

/**
 * Renders a single bot section with status and findings
 */
function BotSection({ botInfo, icon }: BotSectionProps): React.ReactElement {
  return (
    <div style={botCardStyles}>
      <div style={botHeaderStyles}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="material-icons" style={sectionIconStyles}>
            {icon}
          </span>
          <span style={botNameStyles}>{botInfo.name}</span>
        </div>
        <span style={botInfo.success ? botSuccessStyles : botFailStyles}>
          {botInfo.success ? 'Active' : 'N/A'}
        </span>
      </div>
      <div style={botSummaryStyles}>{botInfo.summary}</div>
    </div>
  );
}

interface KeyHorseSectionProps {
  analysis: AIRaceAnalysis;
}

/**
 * Renders key horses section with top pick, value play, and avoid list
 */
function KeyHorseSection({ analysis }: KeyHorseSectionProps): React.ReactElement | null {
  const topPickInsight = analysis.horseInsights.find((h) => h.programNumber === analysis.topPick);
  const valueHorse = analysis.ticketConstruction?.valueHorse;
  const valueHorseInsight =
    valueHorse?.identified && valueHorse.programNumber !== analysis.topPick
      ? analysis.horseInsights.find((h) => h.programNumber === valueHorse.programNumber)
      : null;

  if (!topPickInsight && !valueHorseInsight && analysis.avoidList.length === 0) {
    return null;
  }

  return (
    <div style={sectionStyles}>
      <div style={sectionHeaderStyles}>
        <span className="material-icons" style={sectionIconStyles}>
          emoji_events
        </span>
        <span style={sectionTitleStyles}>Key Horses</span>
      </div>
      <div style={cardStyles}>
        {topPickInsight && (
          <div style={keyHorseRowStyles}>
            <span style={horseNumberStyles}>#{topPickInsight.programNumber}</span>
            <span style={horseNameStyles}>{topPickInsight.horseName}</span>
            <span
              style={{
                ...horseLabelStyles,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--status-success)',
              }}
            >
              TOP PICK
            </span>
          </div>
        )}
        {valueHorseInsight && (
          <div style={keyHorseRowStyles}>
            <span style={horseNumberStyles}>#{valueHorseInsight.programNumber}</span>
            <span style={horseNameStyles}>{valueHorseInsight.horseName}</span>
            <span
              style={{
                ...horseLabelStyles,
                backgroundColor: 'rgba(25, 171, 181, 0.1)',
                color: 'var(--primary)',
              }}
            >
              VALUE
            </span>
          </div>
        )}
        {analysis.avoidList.length > 0 && (
          <div style={lastKeyHorseRowStyles}>
            <span style={{ ...sectionIconStyles, color: 'var(--status-error)' }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>
                block
              </span>
            </span>
            <span style={{ ...horseNameStyles, color: 'var(--text-secondary)' }}>
              Avoid: {analysis.avoidList.map((num) => `#${num}`).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AIAnalysisExpanded displays the full AI analysis when expanded.
 * Shows bot findings, template recommendation, key horses, and betting implications.
 */
export function AIAnalysisExpanded({
  analysis,
  raceNumber,
}: AIAnalysisExpandedProps): React.ReactElement {
  const { ticketConstruction, botDebugInfo } = analysis;

  return (
    <div style={containerStyles}>
      {/* Race Narrative */}
      <div style={sectionStyles}>
        <div style={narrativeStyles}>{analysis.raceNarrative}</div>
      </div>

      {/* Verdict Section */}
      {ticketConstruction?.verdict && (
        <div style={sectionStyles}>
          <div
            style={
              ticketConstruction.verdict.action === 'BET' ? verdictBetStyles : verdictPassStyles
            }
          >
            <span
              className="material-icons"
              style={{
                fontSize: '24px',
                color:
                  ticketConstruction.verdict.action === 'BET'
                    ? 'var(--status-success)'
                    : 'var(--status-warning)',
              }}
            >
              {ticketConstruction.verdict.action === 'BET' ? 'check_circle' : 'cancel'}
            </span>
            <div>
              <div
                style={{
                  fontWeight: 'var(--font-semibold)' as React.CSSProperties['fontWeight'],
                  color:
                    ticketConstruction.verdict.action === 'BET'
                      ? 'var(--status-success)'
                      : 'var(--status-warning)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {ticketConstruction.verdict.action}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {ticketConstruction.verdict.summary}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template & Race Classification */}
      {ticketConstruction && (
        <div style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <span className="material-icons" style={sectionIconStyles}>
              confirmation_number
            </span>
            <span style={sectionTitleStyles}>Ticket Template</span>
          </div>
          <div style={cardStyles}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <span style={getTemplateBadgeStyles(ticketConstruction.template)}>
                TEMPLATE {ticketConstruction.template}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {ticketConstruction.raceType.replace('_', ' ')}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color:
                    ticketConstruction.favoriteStatus === 'VULNERABLE'
                      ? 'var(--status-warning)'
                      : 'var(--text-tertiary)',
                }}
              >
                {ticketConstruction.favoriteStatus} FAVORITE
              </span>
            </div>
            <div style={sectionContentStyles}>{ticketConstruction.templateReason}</div>
          </div>
        </div>
      )}

      {/* Key Horses Section */}
      <KeyHorseSection analysis={analysis} />

      {/* Race Flags */}
      {(analysis.vulnerableFavorite || analysis.likelyUpset || analysis.chaoticRace) && (
        <div style={sectionStyles}>
          <div style={sectionHeaderStyles}>
            <span className="material-icons" style={sectionIconStyles}>
              flag
            </span>
            <span style={sectionTitleStyles}>Race Flags</span>
          </div>
          <div style={flagRowStyles}>
            {analysis.vulnerableFavorite && (
              <span style={warningFlagStyles}>
                <span className="material-icons" style={{ fontSize: '14px' }}>
                  warning
                </span>
                Vulnerable Favorite
              </span>
            )}
            {analysis.likelyUpset && (
              <span style={infoFlagStyles}>
                <span className="material-icons" style={{ fontSize: '14px' }}>
                  trending_up
                </span>
                Upset Likely
              </span>
            )}
            {analysis.chaoticRace && (
              <span style={dangerFlagStyles}>
                <span className="material-icons" style={{ fontSize: '14px' }}>
                  shuffle
                </span>
                Chaotic Race
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bot Analysis Sections */}
      {botDebugInfo && (
        <div style={lastSectionStyles}>
          <div style={sectionHeaderStyles}>
            <span className="material-icons" style={sectionIconStyles}>
              smart_toy
            </span>
            <span style={sectionTitleStyles}>AI Bot Findings</span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                marginLeft: 'auto',
              }}
            >
              {botDebugInfo.successCount}/{botDebugInfo.totalBots} bots active
            </span>
          </div>
          <div style={botGridStyles}>
            <BotSection botInfo={botDebugInfo.tripTrouble} icon={getBotIcon('trip trouble')} />
            <BotSection botInfo={botDebugInfo.paceScenario} icon={getBotIcon('pace scenario')} />
            <BotSection
              botInfo={botDebugInfo.vulnerableFavorite}
              icon={getBotIcon('vulnerable favorite')}
            />
            <BotSection botInfo={botDebugInfo.fieldSpread} icon={getBotIcon('field spread')} />
            <BotSection botInfo={botDebugInfo.classDrop} icon={getBotIcon('class drop')} />
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div
        style={{
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Race {raceNumber}</span>
        <span>
          Analyzed {new Date(analysis.timestamp).toLocaleTimeString()} • {analysis.processingTimeMs}
          ms
        </span>
      </div>
    </div>
  );
}

export default AIAnalysisExpanded;
