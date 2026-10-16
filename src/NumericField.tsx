import { useId, useState, type RefObject } from 'react'
import { formatNumericInput, normalizeNumericInput, numericInputError } from './lib/numericInput'

export function NumericField({
  label,
  value,
  onValueChange,
  min,
  max,
  required = false,
  integer = false,
  allowNegative = false,
  disabled = false,
  placeholder,
  className = '',
  ariaLabel,
  inputRef,
}: {
  label?: string
  value: string
  onValueChange: (value: string) => void
  min?: number
  max?: number
  required?: boolean
  integer?: boolean
  allowNegative?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const error = touched ? numericInputError(value, { label: label || ariaLabel, required, min, max, integer }) : ''
  const input = <>
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={focused ? value : formatNumericInput(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setTouched(true) }}
      onChange={(event) => {
        const normalized = normalizeNumericInput(event.target.value, allowNegative)
        if (normalized != null) onValueChange(normalized)
      }}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    />
    {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
  </>
  if (!label) return <span className={`jh-numeric-field ${className}`}>{input}</span>
  return <div className={`jh-numeric-field ${className}`}><label htmlFor={id}>{label}</label>{input}</div>
}

