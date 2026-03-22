/**
 * SetupWizard — 7-step onboarding wizard.
 *
 * Steps:
 *   1. Welcome (intro + privacy)
 *   2. Chi sei (owner role + name)
 *   3. La tua famiglia (members composition)
 *   4. PIN di sicurezza (parent + child PINs)
 *   5. Permessi personalizzati (access levels per member)
 *   6. Sync cloud (optional encrypted sync)
 *   7. Riepilogo (review + confirm)
 *
 * On completion:
 *   1. Creates family record
 *   2. Creates member records (with hashed PINs, custom access_levels)
 *   3. Creates default budget
 *   4. Optionally registers family on cloud + generates sync secret
 *   5. Sets authStore (familyId, completeSetup)
 *   6. Navigates to /login
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRecord } from '../../lib/crud.js'
import { ROLE_ICONS, MEMBER_COLORS } from '../../lib/constants.js'
import { hashPin } from '../../hooks/useAuth.js'
import useAuthStore from '../../store/authStore.js'
import { isSyncEnabled } from '../../lib/supabase.js'
import { registerFamilyOnCloud } from '../../lib/sync.js'

import WizardStep1 from './WizardStep1.jsx'
import WizardStep2 from './WizardStep2.jsx'
import WizardStep3 from './WizardStep3.jsx'
import WizardStep4 from './WizardStep4.jsx'
import WizardStep5 from './WizardStep5.jsx'
import WizardStep6 from './WizardStep6.jsx'
import WizardStep7 from './WizardStep7.jsx'

const TOTAL_STEPS = 7

export default function SetupWizard() {
  const navigate = useNavigate()
  const { setFamily, setMember, completeSetup, setOwnerName } = useAuthStore()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    // Step 2
    ownerRole: null,   // 'parent' | 'child'
    ownerName: '',
    // Step 3
    adults: [],        // [{ name, role }] — combined (built by WizardStep3)
    parents: [],       // [{ name, role: 'parent' }]
    grandparents: [],  // [{ name, role: 'elder' }]
    hasGrandparents: false,
    hasChildren: false,
    children: [],      // [{ name, age }]
    // Step 4
    parentPin: '',
    parentPinConfirm: '',
    childPin: '',
    childPinConfirm: '',
    // Step 5 — permissions (initialized in WizardStep5)
    permissions: null,  // [{ name, role, accessLevel }]
    // Step 6 — sync
    enableSync: false,
  })

  const updateData = useCallback((partial) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  /**
   * Child join flow — skips steps 4–7.
   * Called by WizardStep3 when child selects their profile.
   */
  const handleChildJoinComplete = ({ familyId, selectedMember }) => {
    setFamily(familyId)
    setMember(selectedMember)
    completeSetup()
    navigate('/login', { replace: true })
  }

  /**
   * Final completion logic — writes everything to Dexie + optional cloud.
   */
  const handleComplete = async () => {
    if (saving) return
    setSaving(true)

    try {
      const familyId = crypto.randomUUID()

      // 1. Create family
      await createRecord('family', {
        id: familyId,
        name: 'La mia famiglia',
        created_by: 'setup',
      })

      // 2. Create adult members with custom permissions
      const parentPinHash = await hashPin(data.parentPin)
      let colorIndex = 0

      for (const adult of data.adults) {
        const icon = ROLE_ICONS[adult.role] || ROLE_ICONS.parent
        const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
        colorIndex++

        // Find custom permission for this member
        const perm = data.permissions?.find((p) => p.name === adult.name && p.role === adult.role)
        const accessLevel = perm?.accessLevel || 'full'

        await createRecord('members', {
          family_id: familyId,
          name: adult.name.trim(),
          role: adult.role,
          access_level: accessLevel,
          icon,
          color,
          pin_hash: parentPinHash,
          age: null,
        })
      }

      // 3. Create child members (if any) with custom permissions
      if (data.hasChildren && data.children.length > 0) {
        const childPinHash = await hashPin(data.childPin)

        for (const child of data.children) {
          const age = parseInt(child.age)
          const icon = ROLE_ICONS.child
          const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
          colorIndex++

          // Find custom permission for this child
          const perm = data.permissions?.find((p) => p.name === child.name && p.role === 'child')
          const accessLevel = perm?.accessLevel || 'basic'

          await createRecord('members', {
            family_id: familyId,
            name: child.name.trim(),
            role: 'child',
            access_level: accessLevel,
            icon,
            color,
            pin_hash: childPinHash,
            age,
          })
        }
      }

      // 4. Create default budget (3000€, no category filter, no month = global)
      await createRecord('budgets', {
        family_id: familyId,
        monthly_amount: 3000,
        category: null,
        month: null,
      })

      // 5. Optional: register family on cloud + generate sync secret
      if (data.enableSync && isSyncEnabled()) {
        try {
          await registerFamilyOnCloud(familyId)
          // Generate and store sync secret for encrypted sync
          const { getOrCreateSyncSecret } = await import('../../lib/deviceSecret.js')
          await getOrCreateSyncSecret(familyId)
          console.log('[Setup] Family registered on cloud with encrypted sync')
        } catch (syncErr) {
          console.warn('[Setup] Cloud registration failed (will retry later):', syncErr.message)
          // Non-blocking: sync can be set up later from Settings
        }
      }

      // 6. Update authStore
      setFamily(familyId)
      setOwnerName(data.ownerName)
      completeSetup()

      // 7. Navigate to login
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Setup failed:', err)
      setSaving(false)
    }
  }

  // Progress indicator dots
  const ProgressDots = () => (
    <div className="flex justify-center gap-2 py-4">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={`h-2 w-2 rounded-full transition-all
            ${n === step ? 'bg-violet-600 scale-125' : n < step ? 'bg-violet-300' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {step > 1 && <ProgressDots />}

      <div className="flex-1">
        {step === 1 && <WizardStep1 onNext={goNext} />}
        {step === 2 && (
          <WizardStep2 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
        {step === 3 && (
          <WizardStep3
            data={data}
            onUpdate={updateData}
            onNext={data.ownerRole === 'child' ? handleChildJoinComplete : goNext}
            onBack={goBack}
          />
        )}
        {step === 4 && (
          <WizardStep4 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
        {step === 5 && (
          <WizardStep5 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
        {step === 6 && (
          <WizardStep6 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
        {step === 7 && (
          <WizardStep7
            data={data}
            onNext={handleComplete}
            onBack={goBack}
            saving={saving}
          />
        )}
      </div>

      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm text-gray-600">Creazione famiglia...</p>
          </div>
        </div>
      )}
    </div>
  )
}
