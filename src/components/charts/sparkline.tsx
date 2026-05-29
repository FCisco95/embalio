interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ data, width = 60, height = 20, className }: SparklineProps) {
  if (data.length < 2) return null

  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * innerW)
  const ys = data.map((v) => pad + innerH - ((v - min) / range) * innerH)

  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const areaPath = `${linePath} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`

  const lastX = xs[xs.length - 1]
  const lastY = ys[ys.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="var(--primary)" />
    </svg>
  )
}
