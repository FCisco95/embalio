"use client"

import { useRef, useState, useEffect } from "react"

interface AreaChartProps {
  data: { x: string; y: number }[]
  height?: number
  className?: string
}

export function AreaChart({ data, height = 180, className }: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [crosshairX, setCrosshairX] = useState<number | null>(null)
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (data.length < 2) return null

  const padT = 8
  const padB = 24
  const padX = 4
  const innerW = width - padX * 2
  const innerH = height - padT - padB

  const min = Math.min(...data.map((d) => d.y))
  const max = Math.max(...data.map((d) => d.y), 1)
  const range = max - min || 1

  const xs = data.map((_, i) => padX + (i / (data.length - 1)) * innerW)
  const ys = data.map((d) => padT + innerH - ((d.y - min) / range) * innerH)

  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const areaPath = `${linePath} L${xs[xs.length - 1]},${height - padB} L${xs[0]},${height - padB} Z`

  const gridLines = [0.25, 0.5, 0.75].map((t) => padT + innerH * (1 - t))

  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * width
    const closest = xs.reduce((bestIdx, x, i) =>
      Math.abs(x - mouseX) < Math.abs(xs[bestIdx] - mouseX) ? i : bestIdx, 0)
    setCrosshairX(xs[closest])
    setTooltipIdx(closest)
  }

  function handleMouseLeave() {
    setCrosshairX(null)
    setTooltipIdx(null)
  }

  const tooltipItem = tooltipIdx !== null ? data[tooltipIdx] : null
  const tooltipXPos = tooltipIdx !== null ? xs[tooltipIdx] : 0
  const tooltipYPos = tooltipIdx !== null ? ys[tooltipIdx] : 0

  return (
    <div ref={containerRef} className={className} style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={width - padX}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        <path d={areaPath} fill="url(#area-fill)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {crosshairX !== null && (
          <line
            x1={crosshairX}
            y1={padT}
            x2={crosshairX}
            y2={height - padB}
            stroke="var(--primary)"
            strokeWidth="1"
            strokeOpacity="0.4"
            strokeDasharray="3 3"
          />
        )}

        {tooltipIdx !== null && (
          <circle cx={xs[tooltipIdx]} cy={ys[tooltipIdx]} r="3" fill="var(--primary)" />
        )}

        {xLabels.map((idx) => (
          <text
            key={idx}
            x={xs[idx]}
            y={height - 6}
            textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {data[idx].x}
          </text>
        ))}
      </svg>

      {tooltipItem && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltipXPos + 8, width - 100),
            top: Math.max(tooltipYPos - 36, 0),
            pointerEvents: "none",
          }}
          className="bg-card border border-border rounded-[8px] px-2.5 py-1.5 text-[12px] shadow-elev whitespace-nowrap"
        >
          <span className="text-muted-foreground">{tooltipItem.x}: </span>
          <span className="font-semibold tabular-nums">{tooltipItem.y}</span>
        </div>
      )}
    </div>
  )
}
