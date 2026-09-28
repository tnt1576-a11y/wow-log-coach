'use client';
// oxlint-disable next/no-img-element -- Game icons use the game asset CDN.
// oxlint-disable jsx-a11y/prefer-tag-over-role -- Legacy icons can occur inside native buttons; the span trigger delegates focus to that control and cannot itself be a nested button.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { Popover } from '@base-ui/react/popover';
import type { AnalysisResult } from '@/lib/domain';
import { iconUrl } from '@/lib/evidence';
import {
  loadSpellDetails,
  tooltipSpellId,
  type SpellDetails,
} from '@/lib/spell-details';
import './ability.css';

type Identity = { id: number; name: string; icon?: string };
const SpellContext = createContext(new Map<string, Identity>());
const interactiveSelector =
  'button,a[href],summary,[role="button"],[role="link"]';
export function AbilityProvider({
  result,
  children,
}: {
  result: AnalysisResult;
  children: React.ReactNode;
}) {
  const spells = useMemo(() => {
    const map = new Map<string, Identity>();
    const add = (spell: Identity) => {
      if (spell.id > 0) map.set(spell.name, spell);
    };
    for (const run of [
      ...result.references.map((run) => run.metrics),
      result.targetMetrics,
    ]) {
      for (const spell of [
        ...(run?.abilities ?? []),
        ...(run?.casts ?? []),
        ...(run?.buffs ?? []),
        ...(run?.damageTaken ?? []),
      ])
        add(spell);
    }
    for (const spell of result.spells ?? []) add(spell);
    for (const spell of result.evidence?.casts ?? []) add(spell);
    return map;
  }, [result]);
  return (
    <SpellContext.Provider value={spells}>
      <Tooltip.Provider delay={250}>{children}</Tooltip.Provider>
    </SpellContext.Provider>
  );
}

type IconProps = { id?: number; icon?: string; name: string; detail?: string };
function useSpellPresentation(
  { id, icon, name }: IconProps,
  holder: React.RefObject<HTMLSpanElement | null>,
) {
  const known = useContext(SpellContext).get(name);
  const spellId = tooltipSpellId(id ?? known?.id, name);
  const [loaded, setLoaded] = useState<{
    id: number;
    value: SpellDetails | null;
  }>();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const info = loaded && loaded.id === spellId ? loaded.value : undefined;
  // Validate each candidate separately. Invalid or failed log icons must not hide metadata icons.
  const url = [icon, known?.icon, info?.icon]
    .map(iconUrl)
    .find((candidate) => candidate && !failed.has(candidate));
  const load = useCallback(() => {
    if (!spellId || (loaded?.id === spellId && loaded.value)) return;
    void loadSpellDetails(spellId).then((value) =>
      setLoaded({ id: spellId, value }),
    );
  }, [spellId, loaded, setLoaded]);
  useEffect(() => {
    if (url || !spellId || loaded?.id === spellId || !holder.current) return;
    let active = true;
    const fetchIcon = () =>
      void loadSpellDetails(spellId).then((value) => {
        if (active) setLoaded({ id: spellId, value });
      });
    if (typeof IntersectionObserver === 'undefined') {
      fetchIcon();
      return () => {
        active = false;
      };
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      fetchIcon();
    });
    observer.observe(holder.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [url, spellId, loaded?.id, holder]);
  return {
    info,
    spellId,
    url,
    load,
    unavailable: loaded?.id === spellId,
    fail: () => {
      if (url) setFailed((current) => new Set([...current, url]));
    },
  };
}

function IconImage({
  name,
  presentation,
}: {
  name: string;
  presentation: ReturnType<typeof useSpellPresentation>;
}) {
  return (
    <>
      <span className="game-icon-fallback">
        {name.slice(0, 2).toUpperCase()}
      </span>
      {presentation.url && (
        <img
          src={presentation.url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={presentation.fail}
        />
      )}
    </>
  );
}
function Description({
  presentation,
}: {
  presentation: ReturnType<typeof useSpellPresentation>;
}) {
  return (
    <>
      <p className="ability-description">
        {presentation.info?.description ||
          (presentation.spellId
            ? presentation.unavailable
              ? 'Game description unavailable.'
              : 'Loading game description…'
            : 'No spell identifier was supplied by this log.')}
      </p>
      {presentation.info?.description && (
        <small>
          Current Wowhead description; values can differ from the logged patch
          or your talents.
        </small>
      )}
    </>
  );
}

/** Compatibility icon: existing enclosing controls keep their own action and one tab stop. */
export function GameIcon(props: IconProps) {
  const holder = useRef<HTMLSpanElement>(null);
  const presentation = useSpellPresentation(props, holder);
  const { load } = presentation;
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const triggerId = useId();
  useEffect(() => {
    const node = holder.current;
    const parent =
      node?.parentElement?.closest<HTMLElement>(interactiveSelector);
    if (!node || !parent) return;
    node.setAttribute('tabindex', '-1');
    node.removeAttribute('role');
    const show = () => {
      setOpen(true);
      load();
    };
    const hide = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    parent.addEventListener('focus', show);
    parent.addEventListener('blur', hide);
    parent.addEventListener('keydown', escape);
    return () => {
      parent.removeEventListener('focus', show);
      parent.removeEventListener('blur', hide);
      parent.removeEventListener('keydown', escape);
    };
  }, [holder, load]);
  useEffect(() => {
    const parent =
      holder.current?.parentElement?.closest<HTMLElement>(interactiveSelector);
    if (!parent || !open) return;
    const ids = new Set(
      (parent.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean),
    );
    ids.add(tooltipId);
    parent.setAttribute('aria-describedby', [...ids].join(' '));
    return () => {
      const remaining = (parent.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((id) => id && id !== tooltipId);
      if (remaining.length)
        parent.setAttribute('aria-describedby', remaining.join(' '));
      else parent.removeAttribute('aria-describedby');
    };
  }, [holder, open, tooltipId]);
  return (
    <Tooltip.Root
      open={open}
      triggerId={triggerId}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) load();
      }}
    >
      <Tooltip.Trigger
        tabIndex={0}
        role="button"
        id={triggerId}
        closeOnClick={false}
        onClick={() => {
          if (!holder.current?.parentElement?.closest(interactiveSelector)) {
            setOpen(true);
            load();
          }
        }}
        onKeyDown={(event) => {
          if (
            (event.key === 'Enter' || event.key === ' ') &&
            !holder.current?.parentElement?.closest(interactiveSelector)
          ) {
            event.preventDefault();
            setOpen(true);
            load();
          }
        }}
        render={
          <span
            ref={holder}
            className="game-icon ability-icon"
            aria-label={`${props.name}${props.detail ? '. ' + props.detail : ''}`}
          />
        }
      >
        <IconImage name={props.name} presentation={presentation} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          sideOffset={8}
          className="ability-tooltip-positioner"
        >
          <Tooltip.Popup id={tooltipId} className="ability-tooltip">
            <strong>{props.name}</strong>
            {presentation.spellId && <span>Spell {presentation.spellId}</span>}
            {props.detail && <p>{props.detail}</p>}
            <Description presentation={presentation} />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** One full-name trigger: hover, keyboard or tap opens details before following an external link. */
export function Ability(props: Identity & { detail?: string }) {
  const holder = useRef<HTMLSpanElement>(null);
  const presentation = useSpellPresentation(props, holder);
  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) presentation.load();
      }}
    >
      <Popover.Trigger
        className="ability-label ability-trigger"
        openOnHover
        delay={250}
        aria-label={'Show details for ' + props.name}
      >
        <span className="game-icon" ref={holder} aria-hidden="true">
          <IconImage name={props.name} presentation={presentation} />
        </span>
        <span>{props.name}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={8}
          className="ability-tooltip-positioner"
        >
          <Popover.Popup className="ability-tooltip" initialFocus={false}>
            <Popover.Title className="ability-title">
              {props.name}
            </Popover.Title>
            <span>Spell {presentation.spellId ?? props.id}</span>
            {props.detail && <p>{props.detail}</p>}
            <Description presentation={presentation} />
            <a
              className="ability-source-link"
              href={`https://www.wowhead.com/spell=${presentation.spellId ?? props.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open game spell details ↗
            </a>
            <Popover.Close
              className="ability-close"
              aria-label="Close spell details"
            >
              Close
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
