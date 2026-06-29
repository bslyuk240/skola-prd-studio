# SkolaTech PRD Studio — Design System & Code Standards

## Design System

### Border Radius (3 values only — use nothing else)
- `rounded` = 6px — inline elements, badges, small chips
- `rounded-lg` = 10px — cards, inputs, buttons, dropdowns
- `rounded-xl` = 14px — large cards, modals, panels
- `rounded-2xl` = 20px — page-level containers, hero cards only

### Spacing (8-point grid)
- Use multiples of 4px: p-1(4), p-2(8), p-3(12), p-4(16), p-5(20), p-6(24), p-8(32), p-10(40), p-12(48)
- Gap between cards: gap-4 (16px)
- Section padding: p-8 (32px)
- Never use odd values like p-7, p-9, p-11

### Type Scale (stick to these — no exceptions)
- Page title: `text-2xl font-bold` (24px/700)
- Section heading: `text-base font-semibold` (16px/600)
- Card title: `text-sm font-semibold` (14px/600)
- Body: `text-sm` (14px/400)
- Caption/label: `text-xs` (12px/400 or 500)
- Stat value: `text-3xl font-bold` (30px/700) — numbers only
- NO text-4xl, text-5xl inside app UI (landing page only)
- NO font-black (900 weight)

### Icon Sizing (relative to text context)
- Next to body text (text-sm): `w-4 h-4`
- Next to caption (text-xs): `w-3 h-3` or `w-3.5 h-3.5`
- Standalone in a container: `w-5 h-5`
- Hero/large card icon: `w-6 h-6` max
- Never `w-8 h-8` or larger inside text-bearing components

### Colors
- Primary actions: `bg-primary` (forest green — already defined)
- Destructive: `bg-destructive` — only for delete/remove
- Success state: `text-emerald-600` (not green-500, not lime)
- Warning: `text-amber-500` (not yellow)
- Error: `text-red-600`
- Muted text: `text-muted-foreground` — use this, not text-gray-* 
- NO purple (`text-purple-*`, `bg-purple-*`) unless it is the defined brand color
- NO gradients on interactive elements (buttons, cards on hover)
- NO `bg-gradient-to-*` on cards — flat backgrounds only
- Hover background: `hover:bg-muted` or `hover:bg-accent` — never color shifts

### Hover & Interaction States
- Button hover: opacity shift (`hover:opacity-90`) or background shift — never scale/glow
- Card hover: `hover:shadow-sm` — 1 elevation step max, never `hover:shadow-xl`
- Link hover: `hover:text-foreground` or `hover:underline` — no color flash
- Transition: `transition-colors` or `transition-shadow` — never `transition-all` on visible elements
- No `hover:scale-*` — no zoom on hover
- No glow: never `hover:shadow-[0_0_*px_*]` or drop-shadow effects on hover
- Active state: `active:translate-y-px` — 1px lift max

### Animations
- Duration: 150ms for micro (color/opacity), 200ms for movement, 300ms for panels
- Easing: `ease-out` for entries, `ease-in` for exits, `ease-in-out` for toggles
- Stagger: 50ms between list items max
- Every animation must serve a purpose — no ambient motion
- No infinite pulse/spin on decorative elements (only loading spinners)
- Loading spinner: `animate-spin` on `Loader2` icon only

### Component Rules

**Buttons**
- Primary: `<Button>` — one per section/card maximum
- Secondary: `<Button variant="outline">` 
- Tertiary: `<Button variant="ghost">`
- Size: `size="sm"` inside cards, default size for page-level actions
- Gap between icon and label: `gap-1.5` (6px)
- NO emoji inside buttons — use Lucide icons only
- NO sparkle/star/magic icons on primary actions — they cheapen the UI
- Loading state: ALWAYS show `<Loader2 className="w-4 h-4 animate-spin" />` during async

**Cards**
- Border: `border border-border` — no colored borders unless status indicator
- Background: `bg-card` — never gradients
- Padding: `p-5` inside CardContent (consistent)
- Shadow: none by default, `shadow-sm` on hover only
- No glass morphism (backdrop-blur on cards)

**Forms / Inputs**
- Label above input always — never placeholder-as-label
- Error state: `aria-invalid` + red helper text below
- No floating labels

**Loading / Skeleton**
- Any fetch >300ms: show skeleton or spinner
- Button clicks: disable + show Loader2 immediately, re-enable on complete
- Page-level data: show skeleton cards, not blank space
- Never show empty state and loading state simultaneously

**Status Badges**
- Use semantic colors: emerald=success, amber=warning, red=error, blue=info, muted=neutral
- Text: short, specific — "Ready", "Pending", "Failed" — not "In Progress Of Being Generated"

---

## Copywriting Rules

### Forbidden phrases (never write these)
- "Launch faster" / "Ship faster" / "Move faster"
- "Build your dreams" / "Build without limits" / "Create without limits"  
- "Supercharge your workflow"
- "The future of [X]"
- "Never [painful thing] again"
- "Your AI-powered [noun]" as a standalone tagline
- Em-dash overuse — max one em-dash per paragraph, prefer commas or periods

### Placeholder content
- NEVER use "Sarah Chen", "John Smith", "Alex Johnson" or any fake personas
- NEVER write fake testimonials or made-up quotes
- NEVER invent stats: "10x faster", "saves 3 hours/week" without source
- For empty states: describe what will appear here — not motivational copy

### Voice
- Direct and specific over vague and inspirational
- Describe what happens, not how it feels
- "Generate all 7 build documents from your app description" > "Turn your vision into reality"
- Button labels: verb + noun — "Generate Document", "Save Preferences", "Download HTML"

---

## Anti-Vibe-Code Checklist

Before shipping any component, verify:
- [ ] Border radius uses only the 3 defined values
- [ ] Icon size matches the text context
- [ ] No purple, no gradients on interactive elements
- [ ] Hover state is max 1 elevation step or opacity change
- [ ] Every button has a loading state
- [ ] No sparkle/emoji/star decorations on functional UI
- [ ] All placeholder text is descriptive, not motivational
- [ ] Type sizes from the defined scale only
- [ ] Spacing follows the 8-point grid
- [ ] Animation has a purpose and a defined easing curve

---

## Generated Document Rules

When generating UX Briefs for user projects, enforce the entire design system above.
Specifically:
- Require the design system to be defined FIRST before any screen specs
- Enforce 2-3 border radius values max
- Forbid generic purple-gradient hero sections
- Require specific hex codes for every named color
- Require loading states to be specified for every async action
- Forbid fake testimonials and placeholder personas like "Sarah Chen"
- Require button labels to follow verb+noun pattern
- Specify easing curves for all transitions (not just "smooth transition")
