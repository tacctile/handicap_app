import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import type { ParsedDRFFile, DRFWorkerProgressMessage } from '../types/drf'
import { parseFileWithFallback } from '../lib/drfWorkerClient'

interface FileUploadProps {
  onParsed?: (data: ParsedDRFFile) => void
}

interface ParsingProgress {
  percent: number
  step: string
  message: string
}

export function FileUpload({ onParsed }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseStatus, setParseStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<ParsingProgress | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleProgress = (progressMessage: DRFWorkerProgressMessage) => {
    setProgress({
      percent: progressMessage.progress,
      step: progressMessage.step,
      message: progressMessage.message,
    })
  }

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.drf')) {
      setParseStatus('error')
      setErrorMessage('Only .drf files are accepted')
      return
    }

    setFileName(file.name)
    setIsParsing(true)
    setParseStatus('idle')
    setErrorMessage(null)
    setProgress({ percent: 0, step: 'reading', message: 'Reading file...' })
    setUsedFallback(false)

    try {
      // Read file content
      const content = await readFileAsText(file)

      if (!content) {
        setIsParsing(false)
        setParseStatus('error')
        setErrorMessage('Failed to read file content')
        setProgress(null)
        return
      }

      // Parse using worker with automatic fallback
      const result = await parseFileWithFallback(content, file.name, {
        timeout: 30000,
        onProgress: handleProgress,
      })

      setIsParsing(false)
      setProgress(null)
      setUsedFallback(result.usedFallback)

      if (result.success && result.data) {
        setParseStatus('success')
        setErrorMessage(null)
        onParsed?.(result.data)
      } else {
        setParseStatus('error')
        setErrorMessage(result.error || 'Failed to parse file')
      }
    } catch (error) {
      setIsParsing(false)
      setParseStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
      setProgress(null)
    }
  }

  const readFileAsText = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        resolve(e.target?.result as string | null)
      }
      reader.onerror = () => {
        resolve(null)
      }
      reader.readAsText(file)
    })
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleButtonClick = () => {
    inputRef.current?.click()
  }

  const getProgressLabel = (): string => {
    if (!progress) return 'Parsing...'

    switch (progress.step) {
      case 'reading':
        return 'Reading file...'
      case 'initializing':
        return 'Initializing parser...'
      case 'detecting-format':
        return 'Detecting format...'
      case 'extracting-races':
        return 'Extracting races...'
      case 'parsing-horses':
        return 'Parsing horses...'
      case 'loading-past-performances':
        return 'Loading past performances...'
      case 'processing-workouts':
        return 'Processing workouts...'
      case 'validating-data':
        return 'Validating data...'
      case 'finalizing':
        return 'Finalizing...'
      case 'complete':
        return 'Complete!'
      default:
        return progress.message || 'Parsing...'
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8
          transition-all duration-200 ease-out
          ${isDragging
            ? 'border-white/40 bg-white/5'
            : 'border-white/10 hover:border-white/20'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".drf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-white/5 p-3">
            {isParsing ? (
              <svg
                className="h-6 w-6 text-white/40 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : parseStatus === 'success' ? (
              <svg
                className="h-6 w-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : parseStatus === 'error' ? (
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            )}
          </div>

          {isParsing ? (
            <div className="text-center w-full">
              <p className="text-sm font-medium text-foreground">{getProgressLabel()}</p>
              <p className="mt-1 text-xs text-white/40">{fileName}</p>
              {progress && progress.percent > 0 && (
                <div className="mt-3 w-full max-w-xs mx-auto">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#19abb5] rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-white/30 tabular-nums">
                    {progress.percent}%
                  </p>
                </div>
              )}
            </div>
          ) : parseStatus === 'success' ? (
            <div className="text-center">
              <p className="text-sm font-medium text-green-400">File parsed successfully</p>
              <p className="mt-1 text-xs text-white/40">{fileName}</p>
              {usedFallback && (
                <p className="mt-1 text-xs text-yellow-400/60">
                  (parsed on main thread)
                </p>
              )}
            </div>
          ) : parseStatus === 'error' ? (
            <div className="text-center">
              <p className="text-sm font-medium text-red-400">Parse failed</p>
              <p className="mt-1 text-xs text-white/40">{errorMessage}</p>
            </div>
          ) : fileName ? (
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{fileName}</p>
              <p className="mt-1 text-xs text-white/40">Ready to process</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-white/60">
                Drop your DRF file here, or
              </p>
            </div>
          )}

          <button
            onClick={handleButtonClick}
            disabled={isParsing}
            className="
              rounded-md bg-white/10 px-4 py-2 text-sm font-medium
              text-foreground transition-all duration-150
              hover:bg-white/15 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isParsing ? 'Parsing...' : 'Upload DRF File'}
          </button>

          {!fileName && !isParsing && parseStatus === 'idle' && (
            <p className="text-xs text-white/30">
              Only .drf files are accepted
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
