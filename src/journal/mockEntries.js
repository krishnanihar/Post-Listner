/**
 * Mock journal entries for Slice 1 — one entry per page.
 * Real entries (glyph + song + summary, recorded from the live session)
 * arrive in a later slice. See docs/desktop-journal-design.md §6.
 */
export const MOCK_ENTRIES = [
  { id: 10, date: 'may 21 · evening', summary: 'the late one — it settled where it wanted to' },
  { id: 9, date: 'may 14 · morning', summary: 'something with rain in it, and no hurry' },
  { id: 8, date: 'may 06 · night', summary: 'a louder room than usual' },
  { id: 7, date: 'apr 28 · afternoon', summary: 'the warm one came back around' },
  { id: 6, date: 'apr 19 · evening', summary: 'low and slow, a held breath' },
  { id: 5, date: 'apr 11 · morning', summary: 'brighter than i expected to be' },
  { id: 4, date: 'apr 02 · night', summary: 'an old key, a near-quiet' },
  { id: 3, date: 'mar 25 · evening', summary: 'the first real storm of the spread' },
  { id: 2, date: 'mar 14 · afternoon', summary: 'patient — it asked nothing of me' },
  { id: 1, date: 'mar 03 · morning', summary: 'where the record begins' },
]
