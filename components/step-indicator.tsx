interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels: string[]
}

export function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  return (
    <div className="mb-5 sm:mb-8">
      {/* Progress percentage */}
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-primary/80 sm:text-sm sm:normal-case sm:tracking-normal sm:text-muted-foreground">
          Étape {currentStep}/{totalSteps}
        </span>
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full rounded-full bg-muted/70 sm:mb-6 sm:h-2">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-primary/10 bg-background/28 px-3.5 py-3 sm:hidden">
        <p className="text-sm font-medium leading-snug text-foreground">{stepLabels[currentStep - 1]}</p>
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
