/**
 * Distribuição das notas (1 a 5) de um álbum, em percentual — usa a mesma
 * linguagem visual de barras verticais da SignalRating, para reforçar a
 * identidade visual do produto.
 */
export default function RatingDistribution({ distribution }) {
  const maxPct = Math.max(1, ...distribution.map((d) => d.pct))

  return (
    <div className="distribution" aria-label="Distribuição das notas do álbum">
      {distribution.map((d) => (
        <div className="distribution__col" key={d.score}>
          <span className="distribution__pct">{d.pct}%</span>
          <div
            className="distribution__bar"
            style={{ height: `${Math.max(3, (d.pct / maxPct) * 100)}%` }}
            title={`${d.count} nota(s) de ${d.score}`}
          />
          <span className="distribution__label">{d.score}</span>
        </div>
      ))}
    </div>
  )
}
