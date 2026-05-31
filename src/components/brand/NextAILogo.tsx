import React from 'react';

interface NextAILogoProps {
  variant?: 'horizontal' | 'symbol';
  height?: number;
  className?: string;
}

export function NextAILogo({ variant = 'horizontal', height, className }: NextAILogoProps) {
  if (variant === 'symbol') {
    const h = height ?? 40;
    const w = Math.round(h * 152 / 162);
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 152 162"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="NextAI"
        role="img"
      >
        <polygon points="27.5,21 44.5,21 34.5,141 17.5,141" fill="#2563EB" />
        <polygon points="117.5,21 134.5,21 124.5,141 107.5,141" fill="#2563EB" />
        <polygon points="37,25 52,17 115,137 100,145" fill="#2563EB" />
      </svg>
    );
  }

  const h = height ?? 32;
  const w = Math.round(h * 555 / 200);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 555 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NextAI"
      role="img"
    >
      {/* N symbol — o símbolo geométrico JÁ É o N; tspan começa em "ext" */}
      <polygon points="39,55 53,55 45,145 31,145" fill="#2563EB" />
      <polygon points="113,55 127,55 119,145 105,145" fill="#2563EB" />
      <polygon points="46.9,58.5 59.1,51.5 111.1,141.5 98.9,148.5" fill="#2563EB" />
      {/* Wordmark — "ext" + "AI" lê-se N(símbolo)+ext+AI = "NextAI" */}
      <text
        y="136"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="100"
        letterSpacing="-3"
      >
        <tspan x="133" fill="currentColor">ext</tspan>
        <tspan fill="#2563EB">AI</tspan>
      </text>
    </svg>
  );
}
