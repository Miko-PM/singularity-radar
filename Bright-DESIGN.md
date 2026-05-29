---
name: Aureate Insight
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#4e4636'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#807664'
  outline-variant: '#d2c5b0'
  surface-tint: '#7a5900'
  primary: '#775700'
  on-primary: '#ffffff'
  primary-container: '#966e01'
  on-primary-container: '#fffbff'
  inverse-primary: '#f0bf56'
  secondary: '#3755c3'
  on-secondary: '#ffffff'
  secondary-container: '#708cfd'
  on-secondary-container: '#00217a'
  tertiary: '#5a5c5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#737576'
  on-tertiary-container: '#fcfdfe'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdea1'
  primary-fixed-dim: '#f0bf56'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5c4200'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b8c4ff'
  on-secondary-fixed: '#001453'
  on-secondary-fixed-variant: '#173bab'
  tertiary-fixed: '#e1e3e4'
  tertiary-fixed-dim: '#c5c7c8'
  on-tertiary-fixed: '#191c1d'
  on-tertiary-fixed-variant: '#454748'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-xl-mobile:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  content-max-width: 960px
  gutter: 24px
  margin-mobile: 16px
  stack-gap: 12px
---

## Brand & Style

This design system is built for a high-density information platform focused on curated intelligence. The brand personality is **authoritative, precise, and sophisticated**, moving away from the dark-themed "hacker" aesthetic into a "Global Journal" aesthetic. 

The visual style is **Corporate Modern with a touch of Minimalism**. It prioritizes extreme legibility and structural clarity. It replaces high-contrast dark backgrounds with a breathable, off-white environment that reduces eye strain for long-form reading. The interface feels established and trustworthy, utilizing refined accents to highlight importance without overwhelming the user.

## Colors

The palette is centered on a **Light Mode** foundation. 

*   **Primary (Amber/Gold):** Used for high-value highlights, active states in the sidebar, and featured badges. It conveys a "premium" layer of information.
*   **Secondary (Professional Blue):** Reserved for technical metadata, links, and secondary interactive elements to provide a calm, corporate counterweight to the gold.
*   **Surface & Background:** The main background is a very clean white (`#FFFFFF`), while containers and the sidebar use a subtle off-white (`#F9FAFB`) to create soft structural separation.
*   **Typography:** The primary text color is a deep charcoal (`#111827`), ensuring maximum contrast and professional presence.

## Typography

This design system employs a tiered typographic scale to manage dense information feeds. 

*   **Headlines (Manrope):** A modern, balanced sans-serif used for article titles and section headers. It provides a clean, geometric feel that looks professional at both large and medium sizes.
*   **Body (Inter):** The workhorse for readability. Used for descriptions, snippets, and general UI labels.
*   **Technical Labels (JetBrains Mono):** Used for metadata, tags (e.g., #AI, #Finance), and timestamps. This monospaced font provides a subtle nod to the technical nature of the content while keeping it distinct from the narrative text.

## Elevation & Depth

To achieve a "professional light" aesthetic, this design system avoids heavy shadows. 

*   **Low-Contrast Outlines:** Containers and feed items are defined by thin `1px` borders in a light gray (`#E5E7EB`).
*   **Tonal Layering:** The main page background is pure white, while "Surface Containers" (like the sidebar or card backgrounds) use a very slight tint (`#F9FAFB`) to create a perceptible but soft sense of depth.
*   **Active State Elevation:** Only "Active" elements (like a selected menu item or a hovered card) may receive a very soft, high-diffusion shadow (8% opacity, 12px blur) to provide tactile feedback.

## Shapes

The shape language is **Soft and Precise**. 

*   Standard components (Inputs, Chips) use a **0.25rem (4px)** radius.
*   Main content cards and large images use a **0.5rem (8px)** radius to feel approachable but remain structured.
*   This conservative rounding maintains the professional "editorial" feel without appearing too playful or "bubbly."

## Components

*   **Cards:** The primary feed unit. They feature a 1px border. Featured cards (Top News) include a `2px` left-accent border in the primary Gold.
*   **Sidebar Links:** Navigation items use high-contrast text. The "Active" state features a soft Gold background fill (10% opacity) and a bolded font weight.
*   **Chips/Tags:** Used for categories. These are styled with a light blue-gray background and `JetBrains Mono` text. They do not have borders to keep the UI clean.
*   **Buttons:** Primary buttons are solid Blue with white text. Secondary buttons use a Gold outline with Gold text.
*   **Inputs:** Minimalist style with a 1px bottom-border that transforms into a full outline on focus.
*   **Data Indicators:** Small numerical indicators (e.g., "99°C") use the secondary Blue to indicate technical data without distracting from the headline.