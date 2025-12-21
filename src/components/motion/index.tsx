/* eslint-disable react-refresh/only-export-components */
import { motion } from 'framer-motion'
import type { HTMLMotionProps, Variants } from 'framer-motion'
import { forwardRef } from 'react'
import type { ReactNode } from 'react'

// Animation variants for staggered children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
}

// Fade in animation
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}

// Slide up animation
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
}

// Scale animation for cards/buttons
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
}

// Hover animations
export const hoverScale = {
  scale: 1.02,
  transition: { type: 'spring', stiffness: 400, damping: 20 },
}

export const tapScale = {
  scale: 0.98,
}

// Card hover with glow
export const cardHover = {
  y: -2,
  boxShadow: '0 8px 30px rgba(25, 171, 181, 0.15)',
  transition: { type: 'spring', stiffness: 300, damping: 25 },
}

// Skeleton loader animation
export const skeletonPulse: Variants = {
  initial: { opacity: 0.4 },
  animate: {
    opacity: [0.4, 0.7, 0.4],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
}

// Ripple effect component for buttons
interface RippleProps {
  x: number
  y: number
  size: number
}

export function Ripple({ x, y, size }: RippleProps) {
  return (
    <motion.span
      className="absolute rounded-full bg-white/30 pointer-events-none"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
      initial={{ scale: 0, opacity: 0.5 }}
      animate={{ scale: 2, opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  )
}

// Skeleton component
interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <motion.div
      className={`bg-white/5 rounded ${className}`}
      style={{ width, height }}
      variants={skeletonPulse}
      initial="initial"
      animate="animate"
    />
  )
}

// Animated container with stagger effect
interface StaggerContainerProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function StaggerContainer({ children, className = '', delay = 0 }: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  )
}

// Animated item for use inside StaggerContainer
interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
}

export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <motion.div ref={ref} className={className} variants={staggerItem} {...props}>
        {children}
      </motion.div>
    )
  }
)

StaggerItem.displayName = 'StaggerItem'

// Fade in wrapper
interface FadeInProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  delay?: number
}

export function FadeIn({ children, className = '', delay = 0, ...props }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Slide up wrapper
interface SlideUpProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  delay?: number
}

export function SlideUp({ children, className = '', delay = 0, ...props }: SlideUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Pulsing glow effect for CTA buttons
export function PulsingGlow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={{
        boxShadow: [
          '0 0 20px rgba(25, 171, 181, 0.2)',
          '0 0 40px rgba(25, 171, 181, 0.4)',
          '0 0 20px rgba(25, 171, 181, 0.2)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

// Page transition wrapper
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  )
}

// Number counter animation
interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
}

export function AnimatedNumber({ value, duration = 0.5, className = '' }: AnimatedNumberProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={value}
    >
      <motion.span
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration, type: 'spring', stiffness: 300 }}
      >
        {value}
      </motion.span>
    </motion.span>
  )
}

// Confidence meter animation
interface ConfidenceMeterProps {
  value: number
  maxValue?: number
  className?: string
}

export function ConfidenceMeter({ value, maxValue = 100, className = '' }: ConfidenceMeterProps) {
  const percentage = Math.min((value / maxValue) * 100, 100)

  return (
    <div className={`relative h-2 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary-hover rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
    </div>
  )
}

// Export motion for custom usage
export { motion }
