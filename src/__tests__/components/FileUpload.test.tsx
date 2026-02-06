/**
 * FileUpload Component Tests
 *
 * Tests upload zone rendering, file type validation,
 * drag-and-drop interaction, and error states.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '../../components/FileUpload';

// ============================================================================
// MOCK SETUP
// ============================================================================

vi.mock('../../lib/drfWorkerClient', () => ({
  parseFileWithFallback: vi.fn(),
}));

vi.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({ addToast: vi.fn() }),
}));

vi.mock('../../services/logging', () => ({
  logger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('FileUpload', () => {
  const onParsed = vi.fn();

  beforeEach(() => {
    onParsed.mockClear();
  });

  describe('Upload Zone Rendering', () => {
    it('renders upload zone with instructions', () => {
      render(<FileUpload onParsed={onParsed} />);
      expect(screen.getByText('Drop your DRF file here, or')).toBeInTheDocument();
    });

    it('renders upload button', () => {
      render(<FileUpload onParsed={onParsed} />);
      expect(screen.getByText('Upload DRF File')).toBeInTheDocument();
    });

    it('shows accepted file type hint', () => {
      render(<FileUpload onParsed={onParsed} />);
      expect(screen.getByText('Only .drf files are accepted')).toBeInTheDocument();
    });

    it('renders hidden file input with .drf accept', () => {
      const { container } = render(<FileUpload onParsed={onParsed} />);
      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input?.getAttribute('accept')).toBe('.drf');
    });
  });

  describe('File Type Validation', () => {
    it('rejects non-.drf files', async () => {
      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const txtFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(input, 'files', { value: [txtFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Only .drf files are accepted')).toBeInTheDocument();
      });
    });

    it('rejects .csv files', async () => {
      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const csvFile = new File(['data'], 'results.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [csvFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Only .drf files are accepted')).toBeInTheDocument();
      });
    });

    it('accepts .drf files', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: true,
        usedFallback: false,
        data: { races: [{ horses: [1, 2, 3] }] },
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['drf content'], 'race.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('race.drf')).toBeInTheDocument();
      });
    });

    it('handles case-insensitive .DRF extension', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: true,
        usedFallback: false,
        data: { races: [{ horses: [1, 2] }] },
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['content'], 'RACE.DRF', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('RACE.DRF')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('shows error icon on parse failure', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: false,
        usedFallback: false,
        error: 'Invalid format',
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['bad data'], 'broken.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Parse failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid format')).toBeInTheDocument();
      });
    });

    it('does not call onParsed on failure', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: false,
        usedFallback: false,
        error: 'Parse error',
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['bad'], 'bad.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('Parse failed')).toBeInTheDocument();
      });

      expect(onParsed).not.toHaveBeenCalled();
    });
  });

  describe('Success State', () => {
    it('shows success state after parse', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      const mockData = { races: [{ horses: [1, 2, 3] }] };
      (parseFileWithFallback as any).mockResolvedValue({
        success: true,
        usedFallback: false,
        data: mockData,
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['drf content'], 'good.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('File parsed successfully')).toBeInTheDocument();
      });

      expect(onParsed).toHaveBeenCalledWith(mockData);
    });

    it('shows fallback indicator when main thread was used', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: true,
        usedFallback: true,
        data: { races: [] },
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['data'], 'race.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('(parsed on main thread)')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('applies dragging class on dragover', () => {
      const { container } = render(<FileUpload onParsed={onParsed} />);
      const dropZone = container.querySelector('[class*="border-dashed"]')!;

      fireEvent.dragOver(dropZone);

      expect(dropZone.className).toContain('border-white/40');
    });

    it('removes dragging class on dragleave', () => {
      const { container } = render(<FileUpload onParsed={onParsed} />);
      const dropZone = container.querySelector('[class*="border-dashed"]')!;

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      expect(dropZone.className).toContain('border-white/10');
    });
  });

  describe('Button Interactions', () => {
    it('triggers file input click when button is clicked', () => {
      render(<FileUpload onParsed={onParsed} />);
      const input = document.querySelector('input[type="file"]')!;
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.click(screen.getByText('Upload DRF File'));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('button text changes to Upload DRF File after successful parse', async () => {
      const { parseFileWithFallback } = await import('../../lib/drfWorkerClient');
      (parseFileWithFallback as any).mockResolvedValue({
        success: true,
        usedFallback: false,
        data: { races: [] },
      });

      render(<FileUpload onParsed={onParsed} />);

      const input = document.querySelector('input[type="file"]')!;
      const drfFile = new File(['drf data'], 'race.drf', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(input, 'files', { value: [drfFile] });
      fireEvent.change(input);

      // After parsing completes, button should return to Upload DRF File
      await waitFor(() => {
        expect(screen.getByText('Upload DRF File')).toBeInTheDocument();
        const btn = screen.getByText('Upload DRF File').closest('button');
        expect(btn).not.toBeDisabled();
      });
    });
  });
});
