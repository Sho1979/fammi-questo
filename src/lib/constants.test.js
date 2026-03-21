/**
 * STEP 1.6 — constants: DEFAULT_CATEGORIES, ACCESS_BY_AGE, NAV_TABS, ROLE_ICONS, MEMBER_COLORS, TASK_CATEGORIES.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  ROLE_ICONS,
  MEMBER_COLORS,
  ACCESS_BY_AGE,
  NAV_TABS,
  TASK_CATEGORIES,
} from './constants.js'

describe('constants', () => {
  describe('DEFAULT_CATEGORIES', () => {
    it('has 16 categories', () => {
      expect(DEFAULT_CATEGORIES).toHaveLength(16)
    })

    it('each category has id, label, icon, color', () => {
      for (const cat of DEFAULT_CATEGORIES) {
        expect(cat).toHaveProperty('id')
        expect(cat).toHaveProperty('label')
        expect(cat).toHaveProperty('icon')
        expect(cat).toHaveProperty('color')
        expect(typeof cat.id).toBe('string')
        expect(typeof cat.label).toBe('string')
        expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })

    it('includes expected expense categories', () => {
      const ids = DEFAULT_CATEGORIES.map(c => c.id)
      expect(ids).toContain('alimentari')
      expect(ids).toContain('trasporto')
      expect(ids).toContain('bollette')
      expect(ids).toContain('affitto')
      expect(ids).toContain('altro')
    })
  })

  describe('ROLE_ICONS', () => {
    it('has parent, elder, child, other', () => {
      expect(ROLE_ICONS.parent).toBeDefined()
      expect(ROLE_ICONS.elder).toBeDefined()
      expect(ROLE_ICONS.child).toBeDefined()
      expect(ROLE_ICONS.other).toBeDefined()
    })
  })

  describe('MEMBER_COLORS', () => {
    it('is non-empty array of hex colors', () => {
      expect(Array.isArray(MEMBER_COLORS)).toBe(true)
      expect(MEMBER_COLORS.length).toBeGreaterThan(0)
      for (const c of MEMBER_COLORS) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })
  })

  describe('ACCESS_BY_AGE', () => {
    it('returns view_only for 0-5', () => {
      expect(ACCESS_BY_AGE(0)).toBe('view_only')
      expect(ACCESS_BY_AGE(5)).toBe('view_only')
    })

    it('returns basic for 6-12', () => {
      expect(ACCESS_BY_AGE(6)).toBe('basic')
      expect(ACCESS_BY_AGE(12)).toBe('basic')
    })

    it('returns calendar_tasks for 13-17', () => {
      expect(ACCESS_BY_AGE(13)).toBe('calendar_tasks')
      expect(ACCESS_BY_AGE(17)).toBe('calendar_tasks')
    })

    it('returns full for 18+', () => {
      expect(ACCESS_BY_AGE(18)).toBe('full')
      expect(ACCESS_BY_AGE(40)).toBe('full')
    })
  })

  describe('NAV_TABS', () => {
    it('has full, calendar_tasks, basic, view_only', () => {
      expect(NAV_TABS.full).toBeDefined()
      expect(NAV_TABS.calendar_tasks).toBeDefined()
      expect(NAV_TABS.basic).toBeDefined()
      expect(NAV_TABS.view_only).toBeDefined()
    })

    it('full has 5 tabs (Home, Calendario, Task, Dispensa, Spese)', () => {
      expect(NAV_TABS.full).toHaveLength(5)
      const paths = NAV_TABS.full.map(t => t.path)
      expect(paths).toContain('/')
      expect(paths).toContain('/calendar')
      expect(paths).toContain('/tasks')
      expect(paths).toContain('/dispensa')
      expect(paths).toContain('/expenses')
    })

    it('each tab has path, label, icon', () => {
      for (const level of Object.keys(NAV_TABS)) {
        for (const tab of NAV_TABS[level]) {
          expect(tab).toHaveProperty('path')
          expect(tab).toHaveProperty('label')
          expect(tab).toHaveProperty('icon')
        }
      }
    })
  })

  describe('TASK_CATEGORIES', () => {
    it('has 4 categories for R2', () => {
      expect(TASK_CATEGORIES).toHaveLength(4)
    })

    it('each has id, label, icon', () => {
      const ids = TASK_CATEGORIES.map(c => c.id)
      expect(ids).toContain('pulizia')
      expect(ids).toContain('personale')
      expect(ids).toContain('studio')
      expect(ids).toContain('altro')
    })
  })
})
