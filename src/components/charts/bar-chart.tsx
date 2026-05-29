"use client"

import { useState } from "react"

interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  className?: string
}

export function BarChart({ data, height = 120, className }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) return null

  const labelH = 20
  const chartH = height - labelH
  const gap = 4
  const totalGap = gap * (data.length - 1)
  const barW = (100 - totalGap) / data.length

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const x = i * (barW + gap)
        const barH = (d.value / max) * chartH
        const y = chartH - barH
        const isHovered = hovered === i
        const labelX = x + barW / 2

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="2"
              fill={isHovered ? "var(--primary)" : "color-mix(in oklch, var(--primary) 30%, transparent)"}
              style={{ transition: "fill 0.12s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={labelX}
              y={height - 4}
              textAnchor="middle"
              fontSize="8"
              fill="var(--muted-foreground)"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
