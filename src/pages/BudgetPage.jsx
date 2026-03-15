/**
 * STEP 8.4 — BudgetPage: BudgetOverview + BudgetSetup.
 */
import useAuthStore from '../store/authStore.js'
import { useBudget, setBudget } from '../hooks/useBudget.js'
import BudgetOverview from '../components/budget/BudgetOverview.jsx'
import BudgetSetup from '../components/budget/BudgetSetup.jsx'

export default function BudgetPage() {
  const { familyId } = useAuthStore()
  const data = useBudget(familyId)

  const handleSaveBudget = async (amount) => {
    await setBudget(familyId, amount, data.budgetId)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      <h2 className="text-xl font-bold text-gray-900">Budget</h2>
      <BudgetOverview
        budget={data.budget}
        spent={data.spent}
        remaining={data.remaining}
        percentage={data.percentage}
        byCategory={data.byCategory}
        alertLevel={data.alertLevel}
      />
      <BudgetSetup
        currentBudget={data.budget}
        onSave={handleSaveBudget}
      />
    </div>
  )
}
