import { budgetPresets, formatMoney } from "@shared/currency"
import { usePrefs } from "@/lib/prefs"

/** Budget in the visitor's currency, stored in INR. Preset chips for one-tap amounts. */
export function BudgetField({ id, valueInr, onChange, label = "Budget" }: { id: string; valueInr: number; onChange: (inr: number) => void; label?: string }) {
  const { currency, rates, fromInr, toInr, locale } = usePrefs()
  const shown = Math.round(fromInr(valueInr))
  return (
    <div className="field">
      <label htmlFor={id}>{`${label} (${currency}, total)`}</label>
      <input id={id} className="input" type="number" inputMode="numeric" min={0} value={shown || ""} onChange={(e) => onChange(Math.round(toInr(Number(e.target.value) || 0)))} />
      <div className="chips" role="group" aria-label="Quick budgets">
        {budgetPresets(currency, rates).map((p) => (
          <button key={p.inr} type="button" className="chip" aria-pressed={Math.abs(valueInr - p.inr) < 2} onClick={() => onChange(p.inr)}>
            {formatMoney(p.shown, currency, locale)}
          </button>
        ))}
      </div>
    </div>
  )
}
