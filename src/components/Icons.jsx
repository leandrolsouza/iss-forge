/**
 * Custom SVG Icons for ISS Editor
 * Style: VS Code Codicon-inspired, 16x16 viewBox, currentColor fill
 */
import React from 'react';

const Icon = ({ children, size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={`iss-icon ${className}`}
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

// --- File Operations ---

export const IconOpen = ({ size }) => (
  <Icon size={size}>
    <path d="M1.5 1h5.586l.707.707L8.5 2.414H14.5l.5.5V5h-1V3H8.5l-.707-.707L7.086 2H2v11h6v1H1.5l-.5-.5v-12l.5-.5z" />
    <path d="M14.5 6h-6.19l-.81 2.426L6 12.5h-.5l-1 3.5h11l1-3.5L14.5 6zM6.5 15l.75-2.5h5.5l.75 2.5H6.5z" />
  </Icon>
);

export const IconSave = ({ size }) => (
  <Icon size={size}>
    <path d="M13.354 1.146l1.5 1.5.146.147V14.5l-.5.5h-13l-.5-.5v-13l.5-.5h11.707l.147.146zM2 2v12h12V3.207L12.793 2H2zm4 0v4h4V2H6zm5 0v5H5V2h1v3.5h3V2h2zM8 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
  </Icon>
);

// --- Editor Types ---

export const IconPlayers = ({ size }) => (
  <Icon size={size}>
    <path d="M8 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
    <path d="M3 12c0-2.21 2.239-4 5-4s5 1.79 5 4v1H3v-1zm1 0h8c0-1.657-1.79-3-4-3s-4 1.343-4 3z" />
  </Icon>
);

export const IconUniform = ({ size }) => (
  <Icon size={size}>
    <path d="M5 1L3 2 1 5l1.5 1L4 4v9h8V4l1.5 2L15 5l-2-3-1-1h-2l-.5 1h-3L6 1H5zm1 1h1l.5 1h3l.5-1h1l1.5 2.5-.5.5-.5-1V12H5V4l-.5 1-.5-.5L5.5 2H6z" />
  </Icon>
);

export const IconHairSkin = ({ size }) => (
  <Icon size={size}>
    <path d="M8 1C5.8 1 4 2.567 4 4.5c0 .517.117 1.008.328 1.457C4.12 6.367 4 6.8 4 7.25c0 .65.29 1.234.75 1.633V10.5a3.5 3.5 0 0 0 6.5 0V8.883c.46-.4.75-.983.75-1.633 0-.45-.12-.883-.328-1.293C11.883 5.508 12 5.017 12 4.5 12 2.567 10.2 1 8 1zm0 1c1.657 0 3 1.12 3 2.5 0 .35-.078.686-.222 1H5.222A2.963 2.963 0 0 1 5 4.5C5 3.12 6.343 2 8 2z" />
  </Icon>
);

export const IconFlag = ({ size }) => (
  <Icon size={size}>
    <path d="M3 1v14h1V9.5c.5-.25 1.5-.5 3-.5s2.5.75 4 .75 2-.25 2.5-.5V2c-.5.25-1 .5-2.5.5S9 1.75 7 1.75 4.5 2 3.5 2.25L3 1zm1 1.75c.5-.15 1.5-.5 3-.5s2.5.75 4 .75 2-.25 2.5-.4v5.9c-.5.15-1 .3-2.5.3S9 8 7 8s-2.5.25-3 .4V2.75z" />
  </Icon>
);

export const IconFlagDesign = ({ size }) => (
  <Icon size={size}>
    <path d="M14.5 1h-13l-.5.5v13l.5.5h13l.5-.5v-13l-.5-.5zM2 2h12v12H2V2z" />
    <rect x="3" y="3" width="4" height="4" opacity="0.7" />
    <rect x="9" y="3" width="4" height="4" opacity="0.4" />
    <rect x="3" y="9" width="4" height="4" opacity="0.4" />
    <rect x="9" y="9" width="4" height="4" opacity="0.7" />
  </Icon>
);

export const IconTeamName = ({ size }) => (
  <Icon size={size}>
    <path d="M1 3h14v1H1V3zm2 3h10v1H3V6zm1 3h8v1H4V9zm2 3h4v1H6v-1z" />
  </Icon>
);

export const IconOverview = ({ size }) => (
  <Icon size={size}>
    <path d="M1.5 2h13l.5.5v11l-.5.5h-13l-.5-.5v-11l.5-.5zM2 3v2h12V3H2zm0 3v7h12V6H2z" />
    <rect x="3" y="7" width="2" height="1.5" rx="0.3" />
    <rect x="3" y="9.5" width="2" height="1.5" rx="0.3" />
    <rect x="6" y="7" width="4" height="1.5" rx="0.3" opacity="0.6" />
    <rect x="6" y="9.5" width="4" height="1.5" rx="0.3" opacity="0.6" />
    <rect x="11" y="7" width="2" height="1.5" rx="0.3" opacity="0.4" />
    <rect x="11" y="9.5" width="2" height="1.5" rx="0.3" opacity="0.4" />
  </Icon>
);

export const IconCompare = ({ size }) => (
  <Icon size={size}>
    <path
      d="M8 1v14M8 1L5 4M8 1l3 3M8 15l-3-3M8 15l3-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <rect x="1" y="5" width="5" height="6" rx="0.5" />
    <rect x="10" y="5" width="5" height="6" rx="0.5" opacity="0.6" />
  </Icon>
);

// --- UI Controls ---

export const IconUndo = ({ size }) => (
  <Icon size={size}>
    <path
      d="M5.5 3L2 6.5 5.5 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2.5 6.5H10a3.5 3.5 0 0 1 0 7H8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </Icon>
);

export const IconRedo = ({ size }) => (
  <Icon size={size}>
    <path
      d="M10.5 3L14 6.5 10.5 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 6.5H6a3.5 3.5 0 0 0 0 7h2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </Icon>
);

export const IconMenu = ({ size }) => (
  <Icon size={size}>
    <path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h12v1H2v-1z" />
  </Icon>
);

export const IconSun = ({ size }) => (
  <Icon size={size}>
    <circle cx="8" cy="8" r="3" />
    <path
      d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </Icon>
);

export const IconMoon = ({ size }) => (
  <Icon size={size}>
    <path d="M6.2 2A6 6 0 0 0 14 9.8 6 6 0 1 1 6.2 2z" />
  </Icon>
);

export const IconChevron = ({ size, expanded }) => (
  <Icon size={size || 12}>
    <path
      d={expanded ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);

export const IconSettings = ({ size }) => (
  <Icon size={size}>
    <path d="M9.1 2H6.9l-.3 1.2c-.3.1-.6.3-.9.5L4.6 3.2l-1.1 1.9.9.9c-.05.3-.05.7 0 1l-.9.9 1.1 1.9 1.1-.5c.3.2.6.4.9.5L6.9 11h2.2l.3-1.2c.3-.1.6-.3.9-.5l1.1.5 1.1-1.9-.9-.9c.05-.3.05-.7 0-1l.9-.9-1.1-1.9-1.1.5c-.3-.2-.6-.4-.9-.5L9.1 2zM8 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
  </Icon>
);

export const IconInfo = ({ size }) => (
  <Icon size={size}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm-.5 3h1v1h-1V5zm0 2h1v5h-1V7z" />
  </Icon>
);

export const IconSparkle = ({ size }) => (
  <Icon size={size}>
    <path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11l-1.3-3.7L3 6l3.7-1.3L8 1z" />
    <path d="M12 10l.7 1.8L14.5 12.5l-1.8.7L12 15l-.7-1.8-1.8-.7 1.8-.7L12 10z" opacity="0.7" />
  </Icon>
);

export const IconCamera = ({ size }) => (
  <Icon size={size}>
    <path d="M6 2l-1 2H2.5l-.5.5v8l.5.5h11l.5-.5v-8l-.5-.5H11l-1-2H6zm0 1h4l1 2h2.5v7h-11V5H5l1-2z" />
    <circle cx="8" cy="8.5" r="2.5" />
  </Icon>
);

export const IconImage = ({ size }) => (
  <Icon size={size}>
    <path d="M2.5 2h11l.5.5v11l-.5.5h-11l-.5-.5v-11l.5-.5zM3 3v8.5l3-3 2 2 3-3.5 2 2.5V3H3zm0 10h10v-1l-2-2.5-3 3.5-2-2-3 3v1z" />
    <circle cx="5.5" cy="5.5" r="1.5" />
  </Icon>
);
