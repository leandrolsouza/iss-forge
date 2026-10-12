import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Text/number input that edits a local draft and calls `onCommit(draft)` once,
 * on Enter or blur — so typing "Ronaldo" is one undo step, not seven, and a
 * number field can be emptied while typing. Escape restores the stored value.
 *
 * `sanitize(draft)` (optional) filters every keystroke (e.g. allowed characters).
 * The commit is skipped when the draft equals the stored value.
 */
export default function DraftInput({ value, onCommit, sanitize, onKeyDown, ...inputProps }) {
  const stored = value ?? '';
  const [draft, setDraft] = useState(String(stored));
  const skipBlur = useRef(false);

  // External changes (undo, team switch, another editor) replace the draft.
  // Layout effect: no one-frame flash of the old value right after a commit.
  useLayoutEffect(() => setDraft(String(stored)), [stored]);

  const commit = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    if (draft !== String(stored)) onCommit(draft);
    // Show the stored value again; if the commit changed it, the effect above
    // picks up the new one (also covers values clamped back to the same number)
    setDraft(String(stored));
  };

  return (
    <input
      {...inputProps}
      value={draft}
      onChange={(e) => setDraft(sanitize ? sanitize(e.target.value) : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(String(stored));
          skipBlur.current = true;
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
}
