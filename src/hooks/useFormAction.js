/**
 * R4.3 — useFormAction: React 19 useActionState wrapper for app forms.
 *
 * Replaces manual useState(saving)/useState(error) patterns in forms.
 * React 19's useActionState manages form state machine automatically:
 *   idle → pending → success | error
 *
 * Usage in ExpenseForm, TaskForm, EventForm:
 *   const [state, submitAction, isPending] = useFormAction(async (prevState, formData) => {
 *     await addExpense({ amount: formData.get('amount'), ... })
 *     return { ok: true }
 *   })
 *
 * Or with the simpler wrapper:
 *   const { formState, handleSubmit, isPending } = useFormAction(myAsyncFn)
 */
import { useActionState } from 'react'

const INITIAL_STATE = {
  ok: null,    // null = not submitted, true = success, false = error
  error: '',
  data: null,
}

/**
 * Creates a form action compatible with React 19's useActionState.
 *
 * @param {Function} action — async (data) => result. Should throw on error.
 * @param {Function} [onSuccess] — called after successful action
 * @returns {{ formState, handleSubmit, isPending }}
 */
export default function useFormAction(action, onSuccess) {
  const [formState, formAction, isPending] = useActionState(
    async (prevState, payload) => {
      try {
        const result = await action(payload)
        // Call onSuccess callback if provided
        if (onSuccess) {
          // Use setTimeout to avoid updating parent state during render
          setTimeout(() => onSuccess(result), 0)
        }
        return { ok: true, error: '', data: result }
      } catch (err) {
        return {
          ok: false,
          error: err.message || 'Errore nel salvataggio',
          data: null,
        }
      }
    },
    INITIAL_STATE
  )

  return { formState, handleSubmit: formAction, isPending }
}

/**
 * Helper: wraps a simple async function into a form-compatible action.
 * Validates required fields before calling the action.
 *
 * @param {Function} asyncFn — async (cleanedData) => result
 * @param {Function} validate — (data) => string|null (null = valid)
 * @param {Function} [onSuccess]
 * @returns {{ formState, submitForm, isPending }}
 */
export function useValidatedFormAction(asyncFn, validate, onSuccess) {
  const [formState, formAction, isPending] = useActionState(
    async (prevState, data) => {
      // Validate
      const validationError = validate?.(data)
      if (validationError) {
        return { ok: false, error: validationError, data: null }
      }

      try {
        const result = await asyncFn(data)
        if (onSuccess) {
          setTimeout(() => onSuccess(result), 0)
        }
        return { ok: true, error: '', data: result }
      } catch (err) {
        return {
          ok: false,
          error: err.message || 'Errore nel salvataggio',
          data: null,
        }
      }
    },
    INITIAL_STATE
  )

  return { formState, submitForm: formAction, isPending }
}
