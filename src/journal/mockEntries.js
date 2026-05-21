/**
 * Mock journal entries for Slice 1 — one entry per page.
 * Real entries (glyph + song + summary, recorded from the live session)
 * arrive in a later slice. See docs/desktop-journal-design.md §6.
 */
export const MOCK_ENTRIES = [
  { id: 10, date: 'may 21 · evening', summary: 'the late one — it settled where it wanted to', region: '41,-74' },
  { id: 9, date: 'may 14 · morning', summary: 'something with rain in it, and no hurry', region: '41,-74' },
  { id: 8, date: 'may 06 · night', summary: 'a louder room than usual', region: '34,-118' },
  { id: 7, date: 'apr 28 · afternoon', summary: 'the warm one came back around', region: '41,-74' },
  { id: 6, date: 'apr 19 · evening', summary: 'low and slow, a held breath', region: '41,-74' },
  { id: 5, date: 'apr 11 · morning', summary: 'brighter than i expected to be', region: '49,2' },
  { id: 4, date: 'apr 02 · night', summary: 'an old key, a near-quiet', region: '41,-74' },
  { id: 3, date: 'mar 25 · evening', summary: 'the first real storm of the spread', region: '41,-74' },
  { id: 2, date: 'mar 14 · afternoon', summary: 'patient — it asked nothing of me', region: '34,-118' },
  { id: 1, date: 'mar 03 · morning', summary: 'where the record begins', region: '41,-74' },
]
