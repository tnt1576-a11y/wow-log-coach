'use client';
import { useState } from 'react';
import { Ability } from './ability';
import type { CharacterSnapshot } from '@/lib/domain';
import { compareRecordedBuilds } from '@/lib/guides/build-comparison';

export function GuideBuildComparison({
  yours,
  theirs,
  referenceName,
}: {
  yours?: CharacterSnapshot | null;
  theirs?: CharacterSnapshot | null;
  referenceName: string;
}) {
  const [search, setSearch] = useState('');
  const comparison = compareRecordedBuilds(yours, theirs);
  const rows = [
    ...comparison.differentRanks,
    ...comparison.oneSided,
    ...comparison.shared,
  ].filter((row) =>
    (row.name + ' ' + row.id)
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <section
      className="guide-build-comparison"
      aria-label="Recorded talent comparison"
    >
      <h4>Before copying this player</h4>
      <p>
        Talents can change which spells you prioritize. Compare the recorded
        build before treating a different sequence as a mistake.
      </p>
      {!comparison.available ? (
        <p className="training-note">
          Talent comparison is unavailable:{' '}
          {comparison.yourCount === 0 ? 'your log' : referenceName + "'s log"}{' '}
          has no usable learned-talent snapshot. This does not mean no talents
          were selected.
        </p>
      ) : (
        <>
          <p>
            {comparison.differentRanks.length
              ? comparison.differentRanks.length +
                (comparison.differentRanks.length === 1
                  ? ' talent has different recorded ranks.'
                  : ' talents have different recorded ranks.')
              : 'No rank differences found among talents recorded for both players.'}{' '}
            {comparison.oneSided.length} entries appear in only one snapshot.
            Their selection in the other build is unknown.
          </p>
          <details>
            <summary>
              Inspect recorded talents ({comparison.yourCount} you /{' '}
              {comparison.referenceCount} reference)
            </summary>
            <label className="training-field">
              Find a talent
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Talent name or spell ID"
              />
            </label>
            <div className="arcane-window-table-wrap">
              <table>
                <caption>
                  Learned ranks reported by the log, not a complete build match
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Talent</th>
                    <th scope="col">You</th>
                    <th scope="col">{referenceName}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        <Ability id={row.id} name={row.name} />
                        {row.status === 'different-rank' && (
                          <small>Different recorded ranks</small>
                        )}
                      </th>
                      <td>{row.you ?? 'Not reported'}</td>
                      <td>{row.reference ?? 'Not reported'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p>No recorded talents match your search.</p>}
            </div>
          </details>
          <p className="training-side-note">
            These snapshots may omit talents. Matching entries do not prove
            identical builds, and a missing entry is not an untalented choice.
            Use the guide for your build; do not copy all reference talents just
            to match their damage.
          </p>
        </>
      )}
    </section>
  );
}
