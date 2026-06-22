# Design Principles

This document defines the visual and interaction language for the ISRO BAH 2026 project. All UI work should adhere to these principles.

## Theme

- **Dark mode always.** There is no light theme. Design exclusively for dark backgrounds.

## Typography

- **Headings:** Bitcount Prop Single
- **Body and everything else:** Ubuntu

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single&family=Ubuntu:wght@300;400;500;700&display=swap');

--font-heading: 'Bitcount Prop Single', monospace;
--font-body: 'Ubuntu', sans-serif;
```

## Shape

- **No border radius.** All corners are sharp (`border-radius: 0`). Buttons, cards, inputs, modals — everything is square.

## Color

A greyscale foundation with a single electric blue accent.

- **Accent:** Electric blue `#00e8f7` — used sparingly for emphasis, interactive states, and key highlights.
- **Greyscale scale:** backgrounds, surfaces, borders, and text are all neutral greys ranging from near-black to near-white.

```css
:root {
  /* Accent */
  --accent: #00e8f7;

  /* Greyscale */
  --bg:        #0a0a0a;  /* page background */
  --surface:   #161616;  /* cards, panels */
  --surface-2: #222222;  /* raised surfaces */
  --border:    #333333;  /* dividers, outlines */
  --text-muted:#888888;  /* secondary text */
  --text:      #e0e0e0;  /* primary text */
}
```

## Motion

- **Subtle animations.** Use restrained transitions and movement to give feedback and guide attention. Favor short durations and gentle easing.
- **No glow effects.** Do not use box-shadow glows, neon halos, or bloom around the accent color. The electric blue earns attention through saturation, not luminance.
