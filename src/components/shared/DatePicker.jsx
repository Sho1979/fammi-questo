/**
 * STEP 3.6 — DatePicker.
 * Native date input with Italian label.
 * Props: value (YYYY-MM-DD string), onChange(value), label?
 */

export default function DatePicker({ value, onChange, label = 'Data' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900
          focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  )
}
