import React, { useEffect, useRef } from 'react';
import type { GuideSection as GuideSectionType } from '../../help/guides';

interface GuideSectionProps {
  section: GuideSectionType;
}

/**
 * GuideSection Component
 *
 * Displays a single guide section with title and formatted content.
 * Supports basic markdown-like formatting.
 */
export function GuideSection({ section }: GuideSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when section changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [section.id]);

  return (
    <div className="guide-section">
      <div className="guide-section-header">
        <span className="material-icons guide-section-icon">{section.icon}</span>
        <h2 className="guide-section-title">{section.title}</h2>
      </div>
      <div ref={contentRef} className="guide-section-content">
        <FormattedContent content={section.content} />
      </div>
    </div>
  );
}

interface FormattedContentProps {
  content: string;
}

/**
 * Renders content with basic markdown-like formatting
 */
function FormattedContent({ content }: FormattedContentProps) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let tableIndex = 0;

  const processLine = (line: string, index: number) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      if (inTable) {
        elements.push(renderTable(tableRows, tableIndex++));
        tableRows = [];
        inTable = false;
      }
      return;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    }

    // If we were in a table and hit a non-table line
    if (inTable) {
      elements.push(renderTable(tableRows, tableIndex++));
      tableRows = [];
      inTable = false;
    }

    // H1 heading
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index}`} className="guide-content-h1">
          {trimmed.slice(2)}
        </h1>
      );
      return;
    }

    // H2 heading
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index}`} className="guide-content-h2">
          {trimmed.slice(3)}
        </h2>
      );
      return;
    }

    // H3 heading
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="guide-content-h3">
          {trimmed.slice(4)}
        </h3>
      );
      return;
    }

    // List item with bullet
    if (trimmed.startsWith('- ')) {
      elements.push(
        <div key={`li-${index}`} className="guide-content-list-item">
          <span className="guide-content-bullet">•</span>
          <span>{formatInlineText(trimmed.slice(2))}</span>
        </div>
      );
      return;
    }

    // Numbered list item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch && numberedMatch[1] && numberedMatch[2]) {
      elements.push(
        <div key={`oli-${index}`} className="guide-content-list-item numbered">
          <span className="guide-content-number">{numberedMatch[1]}.</span>
          <span>{formatInlineText(numberedMatch[2])}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${index}`} className="guide-content-paragraph">
        {formatInlineText(trimmed)}
      </p>
    );
  };

  lines.forEach((line, index) => processLine(line, index));

  // Handle any remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(renderTable(tableRows, tableIndex));
  }

  return <>{elements}</>;
}

/**
 * Renders a markdown-style table
 */
function renderTable(rows: string[], key: number): React.ReactElement {
  const parseRow = (row: string): string[] => {
    return row
      .split('|')
      .filter((cell) => cell.trim() !== '')
      .map((cell) => cell.trim());
  };

  // Filter out separator rows (|---|---|)
  const dataRows = rows.filter((row) => !row.match(/^\|[\s-|]+\|$/));

  if (dataRows.length === 0) return <></>;

  const headerRow = dataRows[0];
  if (!headerRow) return <></>;

  const headerCells = parseRow(headerRow);
  const bodyRows = dataRows.slice(1);

  return (
    <div key={`table-${key}`} className="guide-content-table-wrapper">
      <table className="guide-content-table">
        <thead>
          <tr>
            {headerCells.map((cell, i) => (
              <th key={i}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rowIndex) => {
            const cells = parseRow(row);
            return (
              <tr key={rowIndex}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex}>{formatInlineText(cell)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Formats inline text with bold markers
 */
function formatInlineText(text: string): React.ReactNode {
  // Handle **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default GuideSection;
