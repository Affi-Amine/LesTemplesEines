interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels: string[]
}

export function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Progress percentage */}
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <span className="text-sm font-medium text-muted-foreground">
          Étape {currentStep} sur {totalSteps}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 w-full rounded-full bg-muted sm:mb-6">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-primary/15 bg-card/50 px-4 py-3 sm:hidden">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary/80">En cours</p>
        <p className="mt-1 text-sm font-medium text-foreground">{stepLabels[currentStep - 1]}</p>
      </div>

      {/* Step labels */}
      <div className="hidden justify-between sm:flex">
        {stepLabels.map((label, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mb-2 transition-all ${
                index + 1 <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`text-xs text-center ${index + 1 <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
