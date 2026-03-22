/**
 * SpotlightTour — Guided tour overlay with spotlight hole and tooltip.
 * Uses box-shadow trick for the spotlight cutout (no SVG, no external libs).
 *
 * Props:
 *   steps: Array<{ target, title, body, placement }>
 *   isOpen: boolean
 *   onComplete: () => void
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const PADDING = 8 // px around target element
const TOOLTIP_GAP = 12 // px between spotlight and tooltip
const TRANSITION_MS = 300

export default function SpotlightTour({ steps, isOpen, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [visible, setVisible] = useState(false)
  const tooltipRef = useRef(null)

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step) return
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      // Element not found — skip to next step
      if (!isLast) setCurrentStep((s) => s + 1)
      else onComplete?.()
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Delay measurement to let smooth scroll finish (~400ms)
    setTimeout(() => {
      setTargetRect(el.getBoundingClientRect())
    }, 450)
  }, [step, isLast, onComplete])

  // Open/close handling
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
      setTargetRect(null)
      // Small delay for page to render
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
      setCurrentStep(0)
    }
  }, [isOpen])

  // Measure on step change
  useEffect(() => {
    if (visible) measureTarget()
  }, [visible, currentStep, measureTarget])

  // Recalculate on resize/scroll
  useEffect(() => {
    if (!visible) return
    const recalc = () => measureTarget()
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [visible, measureTarget])

  // Escape key to skip
  useEffect(() => {
    if (!visible) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onComplete?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible, onComplete])

  if (!isOpen || !visible || !step) return null

  // Compute tooltip position
  const getTooltipStyle = () => {
    if (!targetRect) return { opacity: 0 }
    const { placement } = step
    const style = {
      position: 'fixed',
      zIndex: 10000,
      maxWidth: 300,
      transition: `all ${TRANSITION_MS}ms ease`,
    }

    if (placement === 'bottom') {
      style.top = targetRect.bottom + PADDING + TOOLTIP_GAP
      style.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 316))
    } else {
      // top
      style.bottom = window.innerHeight - targetRect.top + PADDING + TOOLTIP_GAP
      style.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 316))
    }
    return style
  }

  return (
    <>
      {/* Backdrop — captures clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={(e) => e.stopPropagation()}
        aria-hidden="true"
      />

      {/* Spotlight hole */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - PADDING,
            left: targetRect.left - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: `all ${TRANSITION_MS}ms ease`,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        style={getTooltipStyle()}
        className="rounded-2xl bg-white p-4 shadow-xl border border-gray-100"
      >
        <h3 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{step.body}</p>

        <div className="flex items-center justify-between">
          {/* Step counter */}
          <span className="text-[10px] font-medium text-gray-300">
            {currentStep + 1}/{steps.length}
          </span>

          <div className="flex items-center gap-2">
            {/* Skip */}
            <button
              type="button"
              onClick={onComplete}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
            >
              Salta
            </button>
            {/* Next / Finish */}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  onComplete?.()
                } else {
                  setCurrentStep((s) => s + 1)
                }
              }}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white
                hover:bg-violet-700 active:scale-95 transition-all"
            >
              {isLast ? 'Fine!' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
