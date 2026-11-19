# Known behavior in the pinned BQQuiz V5 baseline

These findings refer to the original standalone build and source snapshot pinned in [the source checksum ledger](original-source.sha256).

| Area | Existing V5 behavior | Evidence |
| --- | --- | --- |
| Generated quiz order | Practice filters the shared question pool by membership. The visible order can differ from the saved `questionIds` array. The integration must preserve saved IDs and their stored order. | `PracticeViewerV5.tsx` builds `qs` with `sourceQuestions.filter(...)`. |
| Activity links | Activity scroll targets use the source question's original number. Multiple questions can have the same number in a generated quiz. | `PracticeViewerV5.tsx` builds DOM IDs and links from `originalNumber`. |
| Attempt updates and removals | Editing or removing an attempt updates the attempt list without recomputing the derived question state. | `features/practice/practice.ts` updates `attempts` without updating `states`. |
| Reset and backup | Reset asks for confirmation and creates a fresh session ID. The automatic backup mentioned in older notes is absent from the active viewer. | The active `reset` in `PracticeViewerV5.tsx` calls `makeSession`. |
| Review printing | The viewer changes print button labels when switching modes. The interruption slash was hidden in both modes in Chromium print media. | `PracticeViewerV5.tsx` uses `reviewPrint` for labels, and the original print rule hides `.interruption-slash`. |
| Regenerate | The handler sets a new seed and then generates in the same render, which can reuse the previous seed. | `GeneratorV5.tsx` calls `setSeed(randomSeed())` and `generate()` together. |

Steps 1 and 2 leave these areas outside the shell implementation. The saved-order requirement applies when Practice is integrated.
