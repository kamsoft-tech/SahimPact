---
name: Obsidian Slate
colors:
  surface: '#10131c'
  surface-dim: '#10131c'
  surface-bright: '#363943'
  surface-container-lowest: '#0b0e16'
  surface-container-low: '#181b24'
  surface-container: '#1c1f28'
  surface-container-high: '#272a33'
  surface-container-highest: '#32343e'
  on-surface: '#e0e2ee'
  on-surface-variant: '#bfc9c0'
  inverse-surface: '#e0e2ee'
  inverse-on-surface: '#2d303a'
  outline: '#8a938b'
  outline-variant: '#404942'
  surface-tint: '#94d4ad'
  primary: '#94d4ad'
  on-primary: '#003921'
  primary-container: '#5f9d7a'
  on-primary-container: '#00311c'
  inverse-primary: '#2b6a4a'
  secondary: '#bfc1ff'
  on-secondary: '#272a62'
  secondary-container: '#3e417a'
  on-secondary-container: '#adb0f0'
  tertiary: '#ffb3b4'
  on-tertiary: '#532023'
  tertiary-container: '#c57d7f'
  on-tertiary-container: '#4a1a1d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b0f1c8'
  primary-fixed-dim: '#94d4ad'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#0c5134'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#bfc1ff'
  on-secondary-fixed: '#11134c'
  on-secondary-fixed-variant: '#3e417a'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b4'
  on-tertiary-fixed: '#380b10'
  on-tertiary-fixed-variant: '#6e3638'
  background: '#10131c'
  on-background: '#e0e2ee'
  surface-variant: '#32343e'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  caption:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 24px
  gutter: 16px
---

## Brand & Style

This design system is built for administrative power-users who require high-density data visualization and operational control. The brand personality is authoritative, sophisticated, and technically precise. It utilizes a **Corporate Modern** style with a focus on depth through tonal layering rather than excessive decoration.

The UI is designed to feel like a high-performance terminal—stable and reliable—while maintaining a modern aesthetic through the use of vibrant, purposeful accent colors that cut through the deep, desaturated background. It prioritizes clarity and functional hierarchy, ensuring that even in dense layouts, the user's focus is naturally drawn to primary actions and critical status indicators.

## Colors

The palette is anchored by a deep, desaturated blue-grey foundation that provides a low-strain environment for long-term usage. 

- **Primary (Green):** Used for constructive actions, "Create" operations, and positive financial status. It is a muted, "sea-foam" green that remains visible against dark backgrounds without being neon.
- **Secondary (Purple):** Used for administrative actions, utility buttons, and secondary navigation elements.
- **Tertiary/Status (Deep Red):** Reserved for destructive actions like "Delete" or "Log Out" and negative financial indicators.
- **Neutrals:** A tiered system of grey-blues used to define hierarchy through surface brightness.

## Typography

The typography system uses **Manrope** for its technical yet approachable geometric qualities. It is optimized for legibility in data-heavy environments.

- **Headlines:** Use tighter letter spacing and heavier weights to create strong visual anchors.
- **Body Text:** Standardized at 14px for the majority of UI elements to balance density with readability.
- **Labels:** Use a mix of uppercase bold styles for section headers and medium weights for metadata like IDs and timestamps.
- **Numeric Data:** Should always use tabular figures (mono-spacing for numbers) when appearing in lists or ledgers to ensure vertical alignment.

## Layout & Spacing

The system follows a **Fixed-Fluid hybrid** model. The sidebar and navigation elements remain fixed or proportional, while the main content area utilizes a fluid grid that adapts to screen width.

- **Rhythm:** A 4px baseline grid governs all spatial relationships.
- **Density:** The design is high-density. Vertical spacing between related items (like rows in a list) is kept minimal (8px - 12px) to maximize the information visible above the fold.
- **Grouping:** Use 24px - 32px of spacing to separate distinct functional blocks or cards.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and subtle borders rather than heavy shadows.

- **Base Layer:** The darkest shade (`#12141C`), used for the canvas background.
- **Surface Layer:** Used for primary card containers (`#1A1D26`). 
- **Interactive Layer:** Inputs and nested items use the deepest shade (`#11131A`) to create an "etched" or recessed appearance.
- **Outlines:** All containers and interactive elements should have a 1px solid border using a slightly lighter value than the surface color to provide definition in the dark environment.

## Shapes

The design system uses a **Rounded** shape language to soften the technical nature of the dark theme.

- **Containers & Cards:** Use a standard `1rem` (16px) corner radius to define large content areas.
- **Buttons & Inputs:** Use a `0.5rem` (8px) corner radius.
- **Inner Elements:** When nesting items (e.g., a button inside a card), the inner radius should be slightly smaller than the outer radius to maintain visual harmony.

## Components

### Buttons
- **Primary:** Solid fill using the Primary Green. Text is white and bold.
- **Secondary:** Solid fill using the Secondary Purple.
- **Destructive:** Solid fill using the Tertiary Red.
- **Ghost/Text:** Transparent background with Primary or Secondary colored text, used for less frequent actions.

### Cards & Sections
- Cards feature a 1px border and a subtle header area. 
- Large sections (like "New Company") use a distinct background color to separate them from the general feed.

### Form Elements
- **Inputs:** Darker background than the card surface (`#11131A`), 1px border, and 14px typography.
- **Labels:** Positioned above the input, using a smaller font size and secondary text color.

### Navigation Tabs & Sidebar
- The sidebar uses a dark, semi-transparent background with high-contrast icons.
- Active states are indicated by a solid color block or a high-contrast text color change.

### Tables & Ledgers
- Rows should have a subtle hover state (lightening the background slightly).
- Use vertical dividers sparingly; rely on horizontal alignment and spacing to define columns.