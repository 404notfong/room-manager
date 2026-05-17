# Room Manager — Design System

**Style**: Minimalist Pastel · Glassmorphism  
**Typography**: Be Vietnam Pro (body) · Plus Jakarta Sans (display)  
**Palette**: Pastel Indigo / Peach / Mint — Light & Dark Mode  

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Softness** | Rounded corners (`rounded-xl`), diffuse shadows, no harsh lines |
| **Clarity** | Clean hierarchy, generous whitespace, readable typography |
| **Consistency** | Same tokens everywhere — colors from CSS variables, never hardcoded |
| **Accessibility** | WCAG AA+ contrast (4.5:1 minimum), focus-visible rings, semantic HTML |

---

## 2. Color System

All colors use HSL CSS variables defined in `index.css`. Reference via Tailwind utilities like `bg-primary`, `text-success`, etc.

### 2.1 Core Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--background` | `#F7F8FC` (Lavender White) | `#181D2E` (Deep Navy) | Page background |
| `--foreground` | `#1E2338` (Soft Charcoal) | `#EFF1F6` (Bright White) | Primary text |
| `--card` | `#FFFFFF` | `#222840` (Card Navy) | Card/surface background |
| `--primary` | `#6366F1` (Pastel Indigo) | `#C4B5FD` (Luminous Lavender) | Buttons, links, focus rings |
| `--secondary` | `#FCA5A5` (Pastel Peach) | `#F9A8D4` (Soft Pink) | Badges, secondary actions |
| `--accent` | `#34D399` (Pastel Mint) | `#6EE7B7` (Bright Mint) | Highlights, accents |
| `--muted` | `#F1F5F9` (Slate 100) | `#2A3150` (Muted Navy) | Disabled, placeholder |
| `--destructive` | `#EF4444` (Red 500) | `#F87171` (Red 400) | Delete, error actions |

### 2.2 Status Colors (Semantic)

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#10B981` / dark: `#34D399` | Payment paid, room available, active contract |
| `--warning` | `#F59E0B` / dark: `#FBBF24` | Pending, expiring soon, partial payment |
| `--info` | `#3B82F6` / dark: `#60A5FA` | Info alerts, notifications, links |
| `--error` | `#EF4444` / dark: `#F87171` | Errors, overdue, failed |

### 2.3 Domain-Specific Status Mapping

| Entity | Status | Color Token | Badge Variant |
|--------|--------|------------|---------------|
| **Room** | Available | `success` | `bg-success/10 text-success` |
| **Room** | Occupied | `info` | `bg-info/10 text-info` |
| **Room** | Maintenance | `warning` | `bg-warning/10 text-warning` |
| **Contract** | Active | `success` | `bg-success/10 text-success` |
| **Contract** | Pending | `warning` | `bg-warning/10 text-warning` |
| **Contract** | Expired | `muted` | `bg-muted text-muted-foreground` |
| **Contract** | Terminated | `destructive` | `bg-destructive/10 text-destructive` |
| **Payment** | Paid | `success` | `bg-success/10 text-success` |
| **Payment** | Partial | `warning` | `bg-warning/10 text-warning` |
| **Payment** | Unpaid | `destructive` | `bg-destructive/10 text-destructive` |

### 2.4 Chart Palette (Data Visualization)

| Token | Hex (Light) | Hex (Dark) | Usage |
|-------|-------------|------------|-------|
| `--chart-1` | `#6366F1` | `#A5B4FC` | Primary data series |
| `--chart-2` | `#10B981` | `#34D399` | Secondary data series |
| `--chart-3` | `#F59E0B` | `#FBBF24` | Tertiary data series |
| `--chart-4` | `#EC4899` | `#F9A8D4` | Fourth series |
| `--chart-5` | `#3B82F6` | `#60A5FA` | Fifth series |
| `--chart-6` | `#8B5CF6` | `#C4B5FD` | Sixth series |

---

## 3. Typography

### 3.1 Font Stack

```css
--font-sans: "Be Vietnam Pro", "Noto Sans", system-ui, sans-serif;
--font-display: "Plus Jakarta Sans", "Be Vietnam Pro", sans-serif;
```

- **Be Vietnam Pro** — Primary body font (excellent Vietnamese support)
- **Plus Jakarta Sans** — Display/heading font (geometric, modern)
- **Weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Never use** weight 800/900 (Black) — too heavy for pastel style

### 3.2 Type Scale

| Level | Size | Weight | Line Height | Letter Spacing | Font | Usage |
|-------|------|--------|-------------|----------------|------|-------|
| Display | 2.25rem (36px) | 700 | 1.2 | -0.025em | Display | Hero titles, page headers |
| H1 | 1.875rem (30px) | 600 | 1.3 | -0.02em | Display | Page titles |
| H2 | 1.5rem (24px) | 600 | 1.35 | -0.015em | Sans | Section headers |
| H3 | 1.25rem (20px) | 600 | 1.4 | -0.01em | Sans | Card titles |
| H4 | 1.125rem (18px) | 500 | 1.4 | normal | Sans | Sub-section headers |
| Body | 1rem (16px) | 400 | 1.6 | normal | Sans | Paragraphs, descriptions |
| Body-sm | 0.875rem (14px) | 400 | 1.5 | normal | Sans | Table cells, secondary text |
| Caption | 0.75rem (12px) | 400/500 | 1.4 | 0.01em | Sans | Labels, timestamps |

### 3.3 Text Colors

| Purpose | Light | Dark |
|---------|-------|------|
| Primary text | `foreground` (#1E2338) | `foreground` (#EFF1F6) |
| Secondary text | `muted-foreground` (#64748B) | `muted-foreground` (#94A8C5) |
| Disabled text | `muted-foreground/50` | `muted-foreground/50` |
| Links | `primary` | `primary` |

---

## 4. Spacing System

Base unit: **4px**. Use Tailwind spacing utilities (`p-1` = 4px, `p-2` = 8px...).

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px (`p-1`) | Icon padding, tight gaps |
| `sm` | 8px (`p-2`) | Inline element spacing |
| `md` | 12px (`p-3`) | Input padding, small gaps |
| `base` | 16px (`p-4`) | Card padding, list item gaps |
| `lg` | 20px (`p-5`) | Section spacing |
| `xl` | 24px (`p-6`) | Card content padding |
| `2xl` | 32px (`p-8`) | Section dividers |
| `3xl` | 40px (`p-10`) | Page section spacing |
| `4xl` | 48px (`p-12`) | Large section spacing |
| `5xl` | 64px (`p-16`) | Page-level spacing |

### Layout Spacing

| Context | Value |
|---------|-------|
| Page padding (desktop) | `p-8` (32px) |
| Page padding (mobile) | `p-4` (16px) |
| Card inner padding | `p-6` (24px) |
| Form field gap | `gap-4` (16px) |
| Table cell padding | `px-4 py-3` |
| Sidebar width (expanded) | `w-64` (256px) |
| Sidebar width (collapsed) | `w-16` (64px) |
| Header height | `h-14` mobile / `h-16` desktop |

---

## 5. Elevation System

Only soft, diffuse shadows. **No neo-brutalism or hard shadows.**

| Level | Tailwind Class | CSS Value | Usage |
|-------|---------------|-----------|-------|
| 0 | — | none | Flat surfaces, inline elements |
| 1 | `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards, inputs |
| 2 | `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| 3 | `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dialogs |
| 4 | `shadow-xl` | `0 20px 25px rgba(0,0,0,0.1)` | Floating actions, toasts |

> ⚠️ **Anti-pattern**: Never use `shadow-nb`, `shadow-nb-sm`, `shadow-nb-lg` (neo-brutalism). To be removed from config.

---

## 6. Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `sm` | 8px | `rounded-sm` (via `--radius - 4px`) | Small elements, badges |
| `md` | 10px | `rounded-md` (via `--radius - 2px`) | Inputs, buttons (sm) |
| `lg` | 12px | `rounded-lg` (via `--radius`) | Cards, dialogs, inputs |
| `xl` | 16px | `rounded-xl` | Large cards, sections |
| `2xl` | 20px | `rounded-2xl` | Featured cards, hero areas |
| `full` | 9999px | `rounded-full` | Avatars, pill buttons |

**Default radius**: `--radius: 0.75rem` (12px)

---

## 7. Animation Tokens

### 7.1 Durations
| Name | Duration | Usage |
|------|----------|-------|
| `fast` | 150ms | Color changes, opacity |
| `normal` | 200ms | Most transitions |
| `slow` | 300ms | Layout shifts, modals |
| `slower` | 500ms | Page transitions |

### 7.2 Easing
| Name | Value | Usage |
|------|-------|-------|
| `ease-out` | `cubic-bezier(0.33, 1, 0.68, 1)` | Elements appearing |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Elements moving |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions |

### 7.3 Standard Transitions
```css
/* Buttons, links */
transition-colors duration-200

/* Cards, hover effects */
transition-all duration-200 ease-out

/* Sidebar, panels */
transition-all duration-300 ease-in-out

/* Modals, dialogs */
animate-in fade-in duration-200
```

### 7.4 Rules
- **No continuous animations** except loading spinners (`animate-spin`)
- **No `animate-bounce`** on icons or decorative elements
- Respect `prefers-reduced-motion` — disable non-essential animations
- Hover scale transforms limited to `scale-[1.02]` max (avoid layout shift)

---

## 8. Component Patterns

### 8.1 Glassmorphism (Header, Overlays)
```css
bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60
```

### 8.2 Cards
- **Standard**: `rounded-xl border bg-card shadow-sm`
- **Interactive**: Add `hover:shadow-md transition-shadow cursor-pointer`
- **Status card**: Add left border accent: `border-l-4 border-l-success`

### 8.3 Buttons
| Variant | When to use |
|---------|-------------|
| `default` | Primary actions (Save, Create, Submit) |
| `secondary` | Secondary actions (Cancel, Back) |
| `outline` | Tertiary actions (Filter, Export) |
| `ghost` | Icon buttons, toolbar actions |
| `destructive` | Delete, remove actions |
| `link` | Inline text links |

### 8.4 Tables
- Always use `<Table>` from shadcn, never `div`-based grids
- Striped rows: alternate `bg-muted/30` and `bg-transparent`
- Hover: `hover:bg-muted/50`

### 8.5 Forms
- Label always above input, using `<Label>` component
- Error text below input: `text-destructive text-sm`
- Required marker: `<span className="text-destructive">*</span>`

### 8.6 Icons
- **Library**: Lucide React (via `lucide-react`)
- **Size**: `h-4 w-4` (inline), `h-5 w-5` (buttons/nav), `h-6 w-6` (headers)
- **Never use emojis** as UI icons

---

## 9. Anti-Patterns (Avoid)

| ❌ Don't | ✅ Do Instead |
|----------|--------------|
| Pure black `#000000` on white | Soft charcoal `#1E2338` via `foreground` |
| `border-2` or `border-4` | `border` (1px) via `border-border` |
| Neo-brutalism shadows (`shadow-nb`) | Soft shadows (`shadow-sm`, `shadow-md`) |
| Hardcoded color hex values | CSS variable tokens (`bg-primary`) |
| `animate-bounce` on icons | `transition-transform group-hover:scale-110` |
| Layout shift on hover (scale > 1.05) | `scale-[1.02]` max or color-only changes |
| Mixed icon libraries | Lucide React only |
| Emoji icons (🏠 📊 ⚙️) | SVG icons from Lucide |
| Purple/Violet as primary | Pastel Indigo (`#6366F1`) — not purple |

---

## 10. Responsive Strategy

**Approach**: Mobile-first, using Tailwind breakpoints.

| Breakpoint | Width | Target Device |
|-----------|-------|---------------|
| Default | 0px+ | Mobile phones |
| `sm` | 640px+ | Large phones, landscape |
| `md` | 768px+ | Tablets |
| `lg` | 1024px+ | Laptops, desktops |
| `xl` | 1280px+ | Large desktops |
| `2xl` | 1400px+ | Ultra-wide (container max) |

### Layout Rules
- **Sidebar**: Hidden on mobile (slide-in drawer), visible from `lg` up
- **Cards**: Full-width on mobile, 2-column on `md`, 3-4 columns on `lg`+
- **Tables**: Horizontal scroll wrapper on mobile
- **Modals**: Full-screen on mobile, centered dialog on `md`+
- **Page padding**: `p-4` mobile → `p-8` desktop (`lg`)
