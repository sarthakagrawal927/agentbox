# Agent Inbox design context

The owner selected A, Onyx flow, from the liquid-black direction comparison
on 2026-10-07 ("I like A"). This refines the earlier B companion choice and
right-edge pill requirement. Do not add a menu-bar item. Keep the current conversation window
on demand, with its verified reply and permission behavior. Automatic
expansion must not take focus; Escape and a collapse control return to the pill.

## Shared requirements

The first useful screen should distinguish work needing the user from work
still running. A selected session exposes its provider, project, lifecycle
evidence, last request and actual reply/handoff capability without requiring
the user to interpret PIDs or hook names.

Use distinct semantic treatments for needs input, failure/rate limiting,
working, stopped and unavailable evidence. Unknown is not idle or healthy.
Status color always has an accompanying label. A permission request exposes a
permission decision or host-app handoff, never an ordinary reply pretending
to approve it. Preserve draft, focus and keyboard navigation through updates.

Reuse the upstream accessible controls and delivery behavior before building
replacement primitives. Product-specific composition is the direction choice;
no new UI dependency is required for this round.

## Directions to review

- Attention desk: a compact attention list with a stable conversation inspector.
  The inbox is primary; the session wall is a secondary overview.
- Menu companion: a small persistent status menu with direct short replies and
  a full conversation window on demand.
- Session board: a session overview arranged by measured lifecycle state, with
  a conversation drawer and a fullscreen wall mode.

All three must use the same representative tasks and show an unavailable
connection state. Static previews demonstrate composition only; they do not
establish running behavior, accessibility, responsiveness or release readiness.

There is no separate landing page for this development fork. Future marketing,
onboarding and the first useful app screen must share the selected product
identity, vocabulary and verified claims.

## Owner refinement: neutral black

Use the shadcn neutral dark roles for the pill and default conversation surface:
near-black ground, a slightly raised black panel, neutral borders and white type.
Status colors remain restrained and carry text labels. Keep the existing Geist
assets and controls, with no new UI package. Preserve other explicitly chosen
picture themes. The inbox glyph is shared with the conversation navigation.

Panel reveal uses the Transitions.dev panel snippet with 400ms opening, a 12px
travel and its reduced-motion guard. The reveal retains the pill's saved anchor
and does not take focus automatically.

## Owner refinement: darker and movable

Ground is black (#000000), panels #0a0a0a and raised controls #171717. Keep
neutral borders, readable foregrounds and the existing labeled status colors.

The small grip moves the companion. Its native Position menu supplies four
edge presets, display selection and a position lock. Save normalized placement
locally, preserve the physical pill anchor when the panel opens, and expand
toward available space. A missing display falls back to the primary display.
Showing on all Spaces is an explicit option, off by default.

Live preset selection, monitor selection and restart restoration were verified.
Free dragging has controller and geometry coverage; live drag verification is
still pending because the native automation tool could not drag this window.

## Selected refinement: Onyx flow

Sculpted black surfaces use a subtle neutral gradient, 25px companion corners,
hairline edges and restrained amber/blue labeled states. Geist headings and
clear project/provider metadata preserve the familiar conversation controls.
The liquid drop and short ripple mark the edge pill; they do not run continuously.
The conversation's raised reply box and rounded neutral surface share this system.
Existing light and picture themes retain their selected treatments.

Sound starts off and its explicit choice is stored with local companion window
preferences. A new admitted attention cue plays one soft drop; manual opening
or closing plays a short whoosh. Startup and ordinary discovery/status refreshes
are silent. Audio is generated locally with Web Audio, limited to one active
cue, disconnected after playback and stopped when muted or unmounted. Reduced
motion disables the reveal/drop animations. Pinning and sound remain independent.

## Automatic discovery

Retain the accepted list pattern for automatically discovered conversations.
Label them Saved thread, sort them below measured activity and attention, and
use Review import as their action. Keep their count separate from attention.
Disclose the recent-history scope and partial or unavailable discovery in quiet
text. Discovery never expands the pill or takes focus. A saved row opens the
existing import card narrowed to its exact provider/session identity.

## Finishing the selected system

Keep the conversation heading on the same left reading edge as its source
metadata. The inbox heading shares its 24px type scale; small conversation
actions use the same softened corners. At narrower widths, thread titles lead
each existing row and project, priority, owner and updated time reflow below.
State tabs scroll internally; compact header icons retain accessible labels.

Empty content is reassuring only when observation is ready. Scanning, partial
and unavailable discovery each use distinct copy and keep the inbox action
available. Enter and Space belong to a focused button or link; list shortcuts
must not also open or answer a different conversation.

The expanded companion starts with a compact identity and the actual thread
list. Omit announcement headlines and duplicate count summaries; each row
already supplies its title, source and status. Retain discovery warnings,
empty-state guidance and the collapsed pill's accessible status summary.
