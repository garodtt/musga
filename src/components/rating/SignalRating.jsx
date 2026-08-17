import { useState } from 'react'

/**
 * Nota de 1 a 5 representada como barras de sinal (estilo equalizador),
 * em vez de estrelas. Clicável quando `onRate` é passado; caso contrário
 * funciona como exibição somente leitura.
 */
export default function SignalRating({ value = 0, onRate, size = 'md' }) {
  const [hoverValue, setHoverValue] = useState(0)
  const isInteractive = typeof onRate === 'function'
  const displayValue = hoverValue || value

  return (
    <div className="signal-input-wrap">
      <div
        className={`signal ${isInteractive ? 'signal--input' : ''}`}
        style={size === 'sm' ? { height: 16 } : undefined}
        onMouseLeave={() => setHoverValue(0)}
        role={isInteractive ? 'radiogroup' : undefined}
        aria-label="Nota de 1 a 5"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`signal__bar ${n <= displayValue ? 'signal__bar--filled' : ''}`}
            onMouseEnter={() => isInteractive && setHoverValue(n)}
            onClick={() => isInteractive && onRate(n === value ? 0 : n)}
            role={isInteractive ? 'radio' : undefined}
            aria-checked={isInteractive ? n === value : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            onKeyDown={(e) => {
              if (isInteractive && (e.key === 'Enter' || e.key === ' ')) onRate(n)
            }}
          />
        ))}
      </div>
      {value > 0 && <span className="signal-input-wrap__value mono">{value}/5</span>}
    </div>
  )
}
