import React from 'react'

export default function Stave({ width = 300, x = 0, color = 'currentColor', y = 0, lineSpacing = 4, opacity = 1, strokeWidth = 0.4 }) {
  return (
    <g opacity={opacity}>
      {[0, 1, 2, 3].map(i => (
        <line
          key={i}
          x1={x}
          y1={y + i * lineSpacing}
          x2={x + width}
          y2={y + i * lineSpacing}
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}
