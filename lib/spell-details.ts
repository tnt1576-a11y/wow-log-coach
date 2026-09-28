/** WCL reserves 1 for melee events; Wowhead spell 1 is an unrelated legacy spell. */
export function tooltipSpellId(
  id: number | undefined,
  name: string,
): number | undefined {
  if (id === 1 && /^(melee|attack|auto attack)$/i.test(name.trim()))
    return 6603;
  return id && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export interface SpellDetails {
  name: string;
  icon?: string;
  description: string;
}

/** Tooltip markup is converted to text, never inserted as HTML. */
export function tooltipText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<\/(?:div|tr|table|p)>|<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' · ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/(?: · )*\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4500);
}

const details = new Map<number, Promise<SpellDetails | null>>();
export function loadSpellDetails(id: number): Promise<SpellDetails | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return Promise.resolve(null);
  const cached = details.get(id);
  if (cached) return cached;
  const pending = fetch(`https://nether.wowhead.com/tooltip/spell/${id}`, {
    signal: AbortSignal.timeout(7000),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Spell details unavailable');
      const value = (await response.json()) as {
        name?: unknown;
        icon?: unknown;
        tooltip?: unknown;
      };
      if (typeof value.name !== 'string') throw new Error('Unknown spell');
      return {
        name: value.name,
        icon: typeof value.icon === 'string' ? value.icon : undefined,
        description:
          typeof value.tooltip === 'string' ? tooltipText(value.tooltip) : '',
      };
    })
    .catch(() => {
      details.delete(id);
      return null;
    });
  if (details.size >= 600) details.delete(details.keys().next().value!);
  details.set(id, pending);
  return pending;
}
