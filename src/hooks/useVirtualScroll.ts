import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

interface UseVirtualScrollOptions {
  itemCount: number
  itemHeight: number
  containerHeight: number
  overscan?: number // Number of items to render outside visible area
}

interface VirtualScrollResult {
  virtualItems: VirtualItem[]
  totalHeight: number
  containerProps: {
    style: React.CSSProperties
    onScroll: (e: React.UIEvent<HTMLElement>) => void
    ref: React.RefObject<HTMLDivElement | null>
  }
  contentProps: {
    style: React.CSSProperties
  }
}

interface VirtualItem {
  index: number
  start: number
  size: number
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3,
}: UseVirtualScrollOptions): VirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalHeight = itemCount * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      itemCount - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    )

    const items: VirtualItem[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
      })
    }

    return items
  }, [scrollTop, itemHeight, containerHeight, overscan, itemCount])

  return {
    virtualItems,
    totalHeight,
    containerProps: {
      style: {
        height: containerHeight,
        overflow: 'auto',
        position: 'relative' as const,
      },
      onScroll: handleScroll,
      ref: containerRef,
    },
    contentProps: {
      style: {
        height: totalHeight,
        position: 'relative' as const,
      },
    },
  }
}

// Hook to determine if virtual scrolling should be enabled
export function useShouldVirtualize(itemCount: number, threshold = 12): boolean {
  return itemCount > threshold
}

// Window-based virtual scrolling for full-page lists
interface UseWindowVirtualScrollOptions {
  itemCount: number
  itemHeight: number
  overscan?: number
}

export function useWindowVirtualScroll({
  itemCount,
  itemHeight,
  overscan = 5,
}: UseWindowVirtualScrollOptions) {
  const [scrollTop, setScrollTop] = useState(0)
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  )

  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY)
    }

    const handleResize = () => {
      setWindowHeight(window.innerHeight)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const totalHeight = itemCount * itemHeight

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      itemCount - 1,
      Math.floor((scrollTop + windowHeight) / itemHeight) + overscan
    )

    const items: VirtualItem[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
      })
    }

    return items
  }, [scrollTop, windowHeight, itemHeight, overscan, itemCount])

  return {
    virtualItems,
    totalHeight,
    containerStyle: {
      height: totalHeight,
      position: 'relative' as const,
    },
  }
}

// Utility to create item style
export function getVirtualItemStyle(item: VirtualItem): React.CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${item.start}px)`,
    height: item.size,
  }
}
