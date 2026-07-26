import { DollarSign } from 'lucide-react'

interface BudgetSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function BudgetSlider({ value, onChange, min = 0, max = 50 }: BudgetSliderProps) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="budget-range" className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <DollarSign size={16} className="shrink-0 text-accent-400" />
          Presupuesto máximo por hora
        </label>
        <span className="shrink-0 self-start rounded-full bg-accent-500/10 px-3 py-1 text-sm font-semibold text-accent-400 sm:self-auto">
          {value === 0 ? 'Solo voluntariado' : `$${value}/h`}
        </span>
      </div>

      <div className="relative mt-5">
        <input
          id="budget-range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range-slider w-full"
          style={{
            background: `linear-gradient(to right, #38bdf8 0%, #a78bfa ${percent}%, rgba(255,255,255,0.1) ${percent}%, rgba(255,255,255,0.1) 100%)`,
          }}
          aria-valuetext={value === 0 ? 'Solo voluntariado' : `${value} dólares por hora`}
        />
        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
          <span>Voluntariado</span>
          <span>${max}+/h</span>
        </div>
      </div>

      <style>{`
        .range-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
        }
        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.35);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .range-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .range-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border: none;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.35);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
