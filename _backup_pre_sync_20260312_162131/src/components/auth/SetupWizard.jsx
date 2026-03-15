/**
 * STEP 4.5 — SetupWizard container.
 * Manages step navigation (1-4), collects data, and on completion:
 *   1. Creates family record
 *   2. Creates member records (with hashed PINs, roles, access_levels)
 *   3. Creates default budget
 *   4. Sets authStore (familyId, completeSetup)
 *   5. Navigates to /login
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRecord } from '../../lib/crud.js'
import { ACCESS_BY_AGE, ROLE_ICONS, MEMBER_COLORS } from '../../lib/constants.js'
import { hashPin } from '../../hooks/useAuth.js'
import useAuthStore from '../../store/authStore.js'

import WizardStep1 from './WizardStep1.jsx'
import WizardStep2 from './WizardStep2.jsx'
import WizardStep3 from './WizardStep3.jsx'
import WizardStep4 from './WizardStep4.jsx'

const TOTAL_STEPS = 4

export default function SetupWizard() {
  const navigate = useNavigate()
  const { setFamily, completeSetup, setOwnerName } = useAuthStore()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    // Step 2
    ownerRole: null,   // 'parent' | 'child'
    ownerName: '',
    // Step 3
    adults: [],        // [{ name, role }]
    hasChildren: false,
    children: [],      // [{ name, age }]
    // Step 4
    parentPin: '',
    parentPinConfirm: '',
    childPin: '',
    childPinConfirm: '',
  })

  const updateData = useCallback((partial) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  /**
   * Final completion logic — writes everything to Dexie.
   */
  const handleComplete = async () => {
    if (saving) return
    setSaving(true)

    try {
      const familyId = crypto.randomUUID()
      const now = new Date().toISOString()

      // 1. Create family
      await createRecord('family', {
        family_id: familyId,
        name: 'La mia famiglia',
        created_by: 'setup',
      })

      // 2. Create adult members
      const parentPinHash = await hashPin(data.parentPin)
      let colorIndex = 0

      for (const adult of data.adults) {
        const icon = ROLE_ICONS[adult.role] || ROLE_ICONS.parent
        const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
        colorIndex++

        await createRecord('members', {
          family_id: familyId,
          name: adult.name.trim(),
          role: adult.role,
          access_level: 'full',
          icon,
          color,
          pin_hash: parentPinHash,
          age: null,
        })
      }

      // 3. Create child members (if any)
      if (data.hasChildren && data.children.length > 0) {
        const childPinHash = await hashPin(data.childPin)

        for (const child of data.children) {
          const age = parseInt(child.age)
          const accessLevel = ACCESS_BY_AGE(age)
          const icon = ROLE_ICONS.child
          const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
          colorIndex++

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

      // 5. Update authStore
      setFamily(familyId)
      setOwnerName(data.ownerName)
      completeSetup()

      // 6. Navigate to login
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Setup failed:', err)
      setSaving(false)
    }
  }

  // Progress indicator dots
  const ProgressDots = () => (
    <div className="flex justify-center gap-2 py-4">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-2.5 w-2.5 rounded-full transition-all
            ${n === step ? 'bg-violet-600 scale-110' : n < step ? 'bg-violet-300' : 'bg-gray-200'}`}
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
          <WizardStep3 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
        {step === 4 && (
          <WizardStep4
            data={data}
            onUpdate={updateData}
            onNext={handleComplete}
            onBack={goBack}
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
