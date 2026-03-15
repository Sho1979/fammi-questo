/**
 * supabase.js — Supabase client singleton + anonymous auth + CAPTCHA.
 *
 * Auth model:
 *   - L'app usa auth anonimo (signInAnonymously)
 *   - Dopo creazione/join famiglia, il family_id viene salvato nei user_metadata
 *   - Le RLS policies filtrano per family_id dal JWT: auth.jwt()->'user_metadata'->>'family_id'
 *   - Questo garantisce che ogni utente anonimo veda solo i dati della propria famiglia
 *
 * Anti-abuse:
 *   - Cloudflare Turnstile (invisible) CAPTCHA on sign-in
 *   - Set VITE_TURNSTILE_SITE_KEY in .env to enable
 *   - Enable "CAPTCHA protection" in Supabase Dashboard → Auth → Bot Detection
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — sync disabled')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSyncEnabled = () => !!supabase

// ─── Turnstile CAPTCHA ──────────────────────────────────────────

/**
 * Get an invisible Turnstile CAPTCHA token.
 * Returns null if Turnstile is not configured (graceful degradation).
 *
 * Requires the Turnstile script to be loaded in index.html:
 *   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async></script>
 */
async function getTurnstileToken() {
  if (!turnstileSiteKey || typeof window === 'undefined') return null
  if (!window.turnstile) {
    console.warn('[Supabase] Turnstile script not loaded — skipping CAPTCHA')
    return null
  }

  return new Promise((resolve) => {
    try {
      // Create invisible container if needed
      let container = document.getElementById('turnstile-container')
      if (!container) {
        container = document.createElement('div')
        container.id = 'turnstile-container'
        container.style.display = 'none'
        document.body.appendChild(container)
      }

      window.turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: (token) => resolve(token),
        'error-callback': () => {
          console.warn('[Supabase] Turnstile challenge failed — proceeding without CAPTCHA')
          resolve(null)
        },
        size: 'invisible',
      })
    } catch (err) {
      console.warn('[Supabase] Turnstile error:', err)
      resolve(null)
    }
  })
}

// ─── Anonymous Auth ──────────────────────────────────────────────

/**
 * Ensure the user has an anonymous session.
 * If already signed in, returns the existing session.
 * If not, signs in anonymously (with optional CAPTCHA).
 *
 * @returns {Promise<{ user: object, session: object } | null>}
 */
export async function ensureAuth() {
  if (!supabase) return null

  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    return { user: session.user, session }
  }

  // Get CAPTCHA token (null if not configured → Supabase ignores it)
  const captchaToken = await getTurnstileToken()

  // Sign in anonymously with optional CAPTCHA
  const options = captchaToken
    ? { options: { captchaToken } }
    : {}

  const { data, error } = await supabase.auth.signInAnonymously(options)
  if (error) {
    console.error('[Supabase] Anonymous sign-in failed:', error)
    return null
  }

  return data
}

/**
 * Link the current anonymous user to a family.
 * Saves family_id in user_metadata so RLS policies can filter by it.
 *
 * Must be called after:
 *   - Creating a new family (registerFamilyOnCloud)
 *   - Joining an existing family (joinFamilyByCode)
 *
 * @param {string} familyId
 * @returns {Promise<boolean>} true if successful
 */
export async function linkUserToFamily(familyId) {
  if (!supabase) return false

  const { error } = await supabase.auth.updateUser({
    data: { family_id: familyId }
  })

  if (error) {
    console.error('[Supabase] Failed to link user to family:', error)
    return false
  }

  return true
}

/**
 * Get the family_id of the currently authenticated user.
 * @returns {Promise<string|null>}
 */
export async function getLinkedFamilyId() {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.family_id || null
}
