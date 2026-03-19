// ---------------------------------------------------------------------------
//  Agent registry  --  imports all agent profiles and provides lookups
// ---------------------------------------------------------------------------

import cristian from './cristian.js';
import chiara from './chiara.js';
import viola from './viola.js';
import asia from './asia.js';
import mariangela from './mariangela.js';
import roberto from './roberto.js';

// ─── FULL AGENT LIST ──────────────────────────────────────────

/** All 6 family agents ordered by generation then age. */
export const AGENTS = [
  cristian,
  chiara,
  viola,
  asia,
  mariangela,
  roberto,
];

// ─── FILTERED SUBSETS ──────────────────────────────────────────

/** Parents only (role === 'papa' or 'mamma' or generic 'genitore'). */
export const PARENT_AGENTS = AGENTS.filter(
  (a) => a.role === 'papa' || a.role === 'mamma' || a.role === 'genitore',
);

/** Children only (role === 'figlio' or 'figlia'). */
export const CHILD_AGENTS = AGENTS.filter(
  (a) => a.role === 'figlio' || a.role === 'figlia',
);

/** Grandparents only (role === 'nonno' or 'nonna'). */
export const ELDER_AGENTS = AGENTS.filter(
  (a) => a.role === 'nonno' || a.role === 'nonna',
);

// ─── LOOKUPS ──────────────────────────────────────────────────

/**
 * Find an agent profile by its unique id (e.g. 'sim-viola').
 * @param {string} agentId
 * @returns {Object|undefined}
 */
export function getAgent(agentId) {
  return AGENTS.find((a) => a.id === agentId);
}

/**
 * Find an agent profile by display name (case-insensitive).
 * @param {string} name
 * @returns {Object|undefined}
 */
export function getAgentByName(name) {
  const lower = name.toLowerCase();
  return AGENTS.find((a) => a.name.toLowerCase() === lower);
}
