import React from 'react'

export default function Stave({ width = 300, color = 'currentColor', y = 0, lineSpacing = 4, opacity = 1, strokeWidth = 0.4 }) {
  return (
    <g opacity={opacity}>
      {[0, 1, 2, 3].map(i => (
        <line
          key={i}
          x1="0"
          y1={y + i * lineSpacing}
          x2={width}
          y2={y + i * lineSpacing}
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}
