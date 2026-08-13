# BounceBox Design System

## Overview

BounceBox is a bubbly, rainbow-energy design system designed for kids' entertainment and game platforms targeting ages 3-8. Every element is oversized, pill-shaped, and bursting with playful depth through coral, teal, and sunshine yellow. The system prioritizes large touch targets, bold colors, and a joyful visual language that makes interaction feel like play.

---

## Colors

- **Color Primary** (#FF6B6B): Primary actions, main highlights
- **Color Secondary** (#4ECDC4): Supporting accents, navigation
- **Color Tertiary** (#FFE66D): Rewards, stars, celebration
- **Surface Base** (#FFFFFF): Page background
- **Color Success** (#4ECDC4): Correct, completed
- **Color Warning** (#FFE66D): Hints, gentle alerts
- **Color Error** (#FF6B6B): Oops, try again
- **Color Info** (#60A5FA): New, tips

## Typography

- **Headline Font**: Titan One
- **Body Font**: Poppins
- **Mono Font**: Roboto Mono

- **h1**: 48px regular, 1.2 line height. Game titles.
- **h2**: 36px regular, 1.2 line height. Section titles.
- **h3**: 28px regular, 1.25 line height. Card titles.
- **h4**: 22px regular, 1.3 line height. Sub-headings.
- **body**: 18px regular, 1.5 line height. Instructions.
- **small**: 16px regular, 1.5 line height. Labels.
- **xs**: 14px semibold, 1.4 line height. Badges.

---

## Spacing

Base unit: **8px** with generous padding throughout.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Minimal internal gaps
- **md**: 16px — Standard padding
- **lg**: 24px — Card padding, section gaps
- **xl**: 32px — Layout margins
- **2xl**: 48px — Hero spacing
- **3xl**: 64px — Major section breaks
All interactive elements receive extra padding (minimum 16px) for easy tapping by small fingers.

## Border Radius

- **radius-md** (16px): Inputs, smaller elements
- **radius-lg** (24px): Cards, panels, game boards
- **radius-pill** (9999px): Buttons, chips, badges, pills
Everything is very rounded. Buttons and chips are pill-shaped. Cards use 24px radius for a soft, toy-like feel.

## Elevation

Material shadows for playful depth and tactile feel.
- **shadow-sm**: Soft 2px vertical, 4px blur, black at 8% opacity. Resting cards.
- **shadow-md**: Medium 4px vertical, 10px blur, black at 12% opacity. Hovered elements.
- **shadow-lg**: Strong 8px vertical, 20px blur, black at 15% opacity. Modals, pop-ups.
- **shadow-coral**: Warm 4px vertical, 14px blur, coral (#FF6B6B) glow at 35% opacity. Primary CTA glow.
- **shadow-teal**: Cool 4px vertical, 14px blur, teal (#4ECDC4) glow at 35% opacity. Secondary glow.
- **shadow-sunny**: Bright 4px vertical, 14px blur, yellow (#FFE66D) glow at 40% opacity. Reward glow.

## Components

### Buttons

All buttons are pill-shaped (9999px radius) with a minimum 44px touch target for small fingers.

- **Primary**: Coral (#FF6B6B) fill, white (#FFFFFF) text, no border. Hover darkens to #E85D5D. Available in small (16px text, 40px tall, 10px 20px padding), medium (18px text, 48px tall, 12px 28px padding), and large (22px text, 56px tall, 16px 36px padding).
- **Secondary**: Teal (#4ECDC4) fill, white (#FFFFFF) text, no border. Hover darkens to #3DBEB5.
- **Ghost**: Transparent fill, coral (#FF6B6B) text, 3px coral (#FF6B6B) border. Hover fills with faint coral (#FF6B6B at 15% opacity).
- **Destructive**: Red (#EF4444) fill, white (#FFFFFF) text, no border. Hover darkens to #DC2626.

Disabled buttons drop to 0.4 opacity with a disabled cursor and no hover, focus, or glow effects.

### Cards

- **Default**: White (#FFFFFF) background with a 2px #E5E7EB border, shadow-sm at rest, 24px rounded corners. On hover the shadow lifts to shadow-md and the border shifts to teal (#4ECDC4). Padding is 24px.
- **Elevated**: White (#FFFFFF) background with no border, shadow-md at rest, 24px rounded corners. On hover the shadow deepens to shadow-lg. Padding is 24px.

### Inputs

Inputs sit on a white (#FFFFFF) background with 16px rounded corners, 12px 16px padding, and 18px text in Poppins.

In the default state the border is 2px #E5E7EB with no shadow. On hover the border strengthens to 2px #A1A1AA. On focus the border thickens to 3px coral (#FF6B6B) with a 4px coral ring at 25% opacity. In the error state the border becomes 3px #EF4444 over a light red (#FFF5F5) background with a 4px red ring at 20% opacity. When disabled the border returns to 2px #E5E7EB, the background fades to #F9FAFB, and opacity drops to 0.5.

Labels are set in Poppins 16px semibold (600) in content-primary with 6px bottom margin. Helper text is Poppins 14px regular (400) in content-secondary with 6px top margin; error helper text uses color-error.

### Chips

- **Filter**: Light coral (#FF6B6B at 20% opacity) fill, coral (#FF6B6B) text, 2px border at #FF6B6B 40% opacity, pill-shaped, 14px text, 6px 16px padding.
- **Status**: Pill-shaped with no border, 14px text, 6px 16px padding. Background and text vary by severity: success is #D1FAE5 background with #166534 text, warning is #FEF9C3 with #854D0E text, error is #FEE2E2 with #991B1B text.

### Lists

Each row is 56px tall with 0 20px padding, separated by a 2px dashed #E5E7EB divider. Text is Poppins 18px in content-primary. On hover the background tints to #FFF5F5. The active row fills with faint coral (#FF6B6B at 15% opacity) and text turns coral (#FF6B6B).

### Checkboxes

24px square with 8px rounded corners. Unchecked state shows a 3px #E5E7EB border on a white (#FFFFFF) background. When checked the box fills teal (#4ECDC4) with a thick white checkmark. Focus adds a 4px teal ring at 25% opacity. Labels sit 10px away in Poppins 18px.

### Radio Buttons

24px circular. Unchecked state shows a 3px #E5E7EB border on a white (#FFFFFF) background. When selected the border becomes 3px teal (#4ECDC4) and a 12px teal inner dot appears. Focus adds a 4px teal ring at 25% opacity. Labels sit 10px away in Poppins 18px.

### Tooltips

Dark (#2D2D2D) background with white (#FFFFFF) text in Poppins 14px. Padded 8px 16px with 16px rounded corners and an 8px arrow. Maximum width is 220px. Shows after a 400ms delay and hides instantly (longer delay chosen for kids).

---

## Do's and Don'ts

1. **Do** make every interactive element at least 44px tall with generous padding for small fingers.
2. **Do** use pill-shaped buttons and rounded cards consistently to maintain the bubbly toy-like feel.
3. **Do** use bright, saturated colors from the palette; muted or pastel tones undermine the energy.
4. **Don't** use small text below 14px anywhere in the interface; legibility for young readers is critical.
5. **Don't** use complex iconography; prefer simple, chunky icons with thick 3px strokes.
6. **Do** use the sunshine yellow for rewards, stars, and celebration animations.
7. **Don't** use harsh error states; frame mistakes as "Oops, try again!" with the coral color gently.
8. **Do** add colored glow shadows to primary CTAs to make them irresistible to tap.
9. **Don't** place more than three interactive options on screen at once for the target age group.
10. **Do** use dashed dividers and thick borders to reinforce the hand-drawn, playful aesthetic.