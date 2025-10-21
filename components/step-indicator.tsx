interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels: string[]
}

export function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      {/* Progress percentage */}
      <div className="flex justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-6">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="flex justify-between">
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
