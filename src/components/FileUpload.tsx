import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'

export function FileUpload() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (file && file.name.endsWith('.drf')) {
      setFileName(file.name)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
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
          </div>

          {fileName ? (
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
            className="
              rounded-md bg-white/10 px-4 py-2 text-sm font-medium
              text-foreground transition-all duration-150
              hover:bg-white/15 active:scale-[0.98]
            "
          >
            Upload DRF File
          </button>

          {!fileName && (
            <p className="text-xs text-white/30">
              Only .drf files are accepted
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
