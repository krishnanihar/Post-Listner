/**
 * chapters — pure helpers for the journal's month grouping.
 *
 * Kept separate from ChapterIndex.jsx so that file only exports a component
 * (react-refresh requires it). Used by both the chapter rail and the
 * landing screen's record-span line.
 */

export const MONTH_FULL = {
  jan: 'january',
  feb: 'february',
  mar: 'march',
  apr: 'april',
  may: 'may',
  jun: 'june',
  jul: 'july',
  aug: 'august',
  sep: 'september',
  oct: 'october',
  nov: 'november',
  dec: 'december',
}

/** First whitespace-delimited token of an entry's date string, lowercased. */
export const monthOf = (dateStr) => dateStr.trim().split(/\s+/)[0].toLowerCase()

/** Group entries (newest-first) into month chapters, keeping the array index of each month's newest entry. */
export function buildChapters(entries) {
  const out = []
  entries.forEach((e, i) => {
    const abbr = monthOf(e.date)
    if (!out.length || out[out.length - 1].abbr !== abbr) {
      out.push({ abbr, name: MONTH_FULL[abbr] || abbr, index: i })
    }
  })
  return out
}
