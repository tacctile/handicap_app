import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import type { ParsedDRFFile, DRFWorkerRequest, DRFWorkerResponse } from '../types/drf'

interface FileUploadProps {
  onParsed?: (data: ParsedDRFFile) => void
}

export function FileUpload({ onParsed }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseStatus, setParseStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Initialize the worker
    workerRef.current = new Worker(
      new URL('../lib/drfWorker.ts', import.meta.url),
      { type: 'module' }
    )

    workerRef.current.onmessage = (event: MessageEvent<DRFWorkerResponse>) => {
      setIsParsing(false)
      const response = event.data

      if (response.type === 'success' && response.data) {
        setParseStatus('success')
        setErrorMessage(null)
        onParsed?.(response.data)
      } else {
        setParseStatus('error')
        setErrorMessage(response.error || 'Failed to parse file')
      }
    }

    workerRef.current.onerror = (error) => {
      setIsParsing(false)
      setParseStatus('error')
      setErrorMessage(error.message || 'Worker error')
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [onParsed])

  const processFile = (file: File) => {
    if (!file.name.endsWith('.drf')) {
      setParseStatus('error')
      setErrorMessage('Only .drf files are accepted')
      return
    }

    setFileName(file.name)
    setIsParsing(true)
    setParseStatus('idle')
    setErrorMessage(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (workerRef.current && content) {
        const request: DRFWorkerRequest = {
          type: 'parse',
          fileContent: content,
          filename: file.name,
        }
        workerRef.current.postMessage(request)
      }
    }
    reader.onerror = () => {
      setIsParsing(false)
      setParseStatus('error')
      setErrorMessage('Failed to read file')
    }
    reader.readAsText(file)
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
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Parsing...</p>
              <p className="mt-1 text-xs text-white/40">{fileName}</p>
            </div>
          ) : parseStatus === 'success' ? (
            <div className="text-center">
              <p className="text-sm font-medium text-green-400">File parsed successfully</p>
              <p className="mt-1 text-xs text-white/40">{fileName}</p>
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
