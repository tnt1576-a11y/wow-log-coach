# Features and coverage

## Review views

- **Run review:** supported priorities with timestamps, evidence and next actions.
- **Rotation comparison:** one reference at a time; spell output, cast frequency, equal-duration sequences, and ability timing tracks. Boss pairing uses encounter IDs; uncertain pairings need a choice.
- **Cooldown timing:** player-by-ability timelines, exact timestamps, seconds/fight-percentage alignment, and on-demand reference event loading for both Mythic+ and raids.
- **Defensives & survival:** deaths and sampled intake peaks, incoming attack/enemy breakdowns, personal casts, recorded external defensive support, aura coverage when available, and independent reference danger windows.
- **Damage diagnosis:** contribution, casts per minute, damage per recorded cast, and supported comparisons with visible sample limits.
- **Abilities & buffs:** search, spell DPS and casts, reference participation, buff uptime, game icons and on-demand tooltips with fallbacks.
- **Gear & stats:** recorded item level, raw stat values, items, gems, enchants, cohort distributions and individual-reference loadouts.
- **Practice workshop:** review queue, pull consistency, observed strengths, death review, selected practice focus and copyable next-run notes.
- **References:** individual DPS rankings, verified filters, distinct-player selection, player/log links, exclusion counts and API usage. Analysis can be exported as JSON.

## Additional Mythic+ guide checks

General review works across eligible DPS specializations. These specs have extra curated checks; the list does not imply a complete rotation simulator.

| Specialization | Examples and details |
| --- | --- |
| Arcane Mage | Hero/talent context, Touch cadence, burst preparation, observed mana and reference sequences. |
| Fire Mage | Recorded Combustion windows, Hot Streak chains and Hyperthermia follow-through. |
| Frost Mage | Brain Freeze/Fingers of Frost conversion, charge pressure, talent-gated follow-ups. |
| Shadow Priest | Mind Devourer, Void Volley and recorded burst overlap. |
| Survival Hunter | Tip of the Spear coverage, Takedown preparation and hero procs. |
| Fury Warrior | Enrage context, Sudden Death, Thunder Blast and Recklessness windows. |
| Demonology Warlock | Tyrant follow-up, Power Siphon and Demonic Core state. |
| Windwalker Monk | Repeated core attacks and complete Dance of Chi-Ji windows. |
| Frost / Unholy Death Knight, Elemental Shaman, Arms Warrior | Recorded proc-window follow-through and reference timing. |
| Assassination / Outlaw Rogue | Kingsbane/Envenom and Deathmark context; recorded six-stack Opportunity decisions. |

Guide rules are tied to supported mechanics, patch/partition and available evidence. Raid views provide general comparisons and timing; Mythic+ guide findings are not automatically applied to raid encounters.

## How to interpret a comparison

The app records differences and suggests supported questions/actions. It does not isolate every cause of performance. Group composition, offensive externals, pull size, route, duration, assignments and equipment can all matter.

Events can be incomplete; missing snapshots and unknown states are disclosed. Cooldown readiness, all resets, exact target counts, full resource affordability and ideal rotation are not universally reconstructed. Fewer than eight references suppresses cohort findings. Item popularity does not establish best-in-slot gear, and raw stats are not damage-normalized weights.

Terrain markers indicate first-hit enemies in recorded pulls, not a player-position replay or recommended route. Unverified map floors do not get invented coordinates. [Terrain sources](../public/maps/SOURCES.md)

For setup, controls and interpretation, see the [user guide](USER_GUIDE.md).
