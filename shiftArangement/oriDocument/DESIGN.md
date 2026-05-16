---
name: Duty Management System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d8d9e3'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ecedf7'
  surface-container-high: '#e6e8f2'
  surface-container-highest: '#e0e2ec'
  on-surface: '#191c23'
  on-surface-variant: '#414754'
  inverse-surface: '#2d3038'
  inverse-on-surface: '#eff0fa'
  outline: '#727785'
  outline-variant: '#c1c6d6'
  surface-tint: '#005bc0'
  primary: '#005bbf'
  on-primary: '#ffffff'
  primary-container: '#1a73e8'
  on-primary-container: '#ffffff'
  inverse-primary: '#adc7ff'
  secondary: '#006e2c'
  on-secondary: '#ffffff'
  secondary-container: '#86f898'
  on-secondary-container: '#00722f'
  tertiary: '#9e4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#c55500'
  on-tertiary-container: '#0e0200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc7ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#89fa9b'
  secondary-fixed-dim: '#6ddd81'
  on-secondary-fixed: '#002108'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783100'
  background: '#f9f9ff'
  on-background: '#191c23'
  surface-variant: '#e0e2ec'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 16px
  card-gap: 12px
  grid-gutter: 1px
---

## Brand & Style

The design system is anchored in the principles of **Modern Corporate Minimalism**. It is designed to facilitate high-stakes administrative tasks—duty scheduling and reporting—with an emphasis on professional reliability and cognitive ease. 

The aesthetic focuses on "utility first," utilizing generous whitespace to prevent information fatigue during complex scheduling tasks. By combining a systematic approach to color with a structured grid, the design system evokes a sense of order and trust. The interface prioritizes the **Thumb Zone** (the bottom two-thirds of the screen) to ensure that the most frequent actions—switching shifts or submitting reports—are easily accessible during one-handed mobile use.

## Colors

The color palette is functional and semantic, designed to provide immediate visual feedback without overwhelming the user.

- **Primary Blue (#1A73E8):** Used for primary actions, active navigation states, and branding elements. It communicates stability and institutional authority.
- **Success Green (#34A853):** Reserved for "Available" states, successful submissions, and positive status indicators.
- **Warning Red (#EA4335):** Strictly used for schedule conflicts, overdue tasks, or destructive actions.
- **Neutral Greys:** A tiered grey scale is used for background surfaces (#F8F9FA) and text to establish a clear information hierarchy, keeping secondary information legible but unobtrusive.

## Typography

The design system utilizes **Inter** for its exceptional legibility on small screens and its neutral, professional tone. 

The type scale is strictly enforced to create visual rhythm. Bold weights are reserved for page headers and critical status labels, while medium weights are used for interactive elements like buttons and navigation. To ensure accessibility, the minimum body text size is set to 14px, and line heights are optimized to maintain readability even in data-dense scheduling tables.

## Layout & Spacing

This design system employs a **Fluid Grid** model with a base unit of **8px**. 

- **Margins:** A consistent 16px lateral margin is applied across all mobile views to provide breathing room.
- **Duty Grid:** For the calendar and time-slot views, a high-density grid is used with 1px gutters (dividers) to maximize screen real estate while maintaining clear cell boundaries.
- **One-Hand Optimization:** Primary action buttons (e.g., "Submit Duty") are positioned within the lower 30% of the screen. Interactive cards use a 12px vertical gap to ensure distinct tap targets, reducing accidental inputs.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and subtle **Ambient Shadows**.

- **Level 0 (Background):** Solid #F8F9FA.
- **Level 1 (Cards/Surface):** Pure white (#FFFFFF) with a very soft, low-opacity shadow (4px blur, 2% alpha). This creates a subtle "lift" that identifies interactive duty cards against the grey background.
- **Level 2 (Modals/Overlays):** Used for quick-edit duty panels, featuring a slightly more pronounced shadow to focus user attention.
- **Dividers:** Used only when necessary in the grid layout, utilizing #E8EAED to separate time slots without adding visual noise.

## Shapes

The shape language is defined by **Softened Precision**. 

The base roundedness is 8px (0.5rem), providing a modern, approachable feel while maintaining the professional structure of the grid. 
- **Cards:** Use the standard 12px (0.75rem) corner radius to create a containerized, tactile feel.
- **Status Tags:** Use a fully rounded "pill" shape (capsule) to distinguish them from interactive buttons or static data cards.
- **Input Fields:** Maintain an 8px radius for a clean, architectural look that aligns with the primary action buttons.

## Components

- **Duty Cards:** These are the primary data containers. They feature a left-border accent color corresponding to the status (Blue for scheduled, Green for completed). Information is stacked vertically: Time > Location > Personnel.
- **Status Chips:** Small, high-contrast labels with light background tints (e.g., 10% opacity Green) and dark text for "Available" or "Off-duty."
- **Schedule Grid:** A responsive 7-column or 1-column (daily) view. Active cells use a light blue tint to indicate selection.
- **Action Buttons:** Large, full-width buttons at the bottom of the screen with a 50px height to ensure high hit-rate during mobile use.
- **Segmented Control:** A flat, rounded toggle used to switch between "Personal Schedule" and "Team View," providing instant filtering without page reloads.
- **Conflict Warning:** A specific card variation with a pale red background and the Warning Red icon to alert the user of overlapping shifts.