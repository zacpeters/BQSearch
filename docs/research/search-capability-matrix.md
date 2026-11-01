# Search Capability Matrix

Status meanings: **Working** means the supplied scenario is supported by the current implementation; **Partial** means a useful subset works but the coaching scenario has material limitations; **Missing** means there is no dedicated implementation; **Unknown** means the repository does not provide enough evidence.

| Coaching scenario | Current implementation and evidence | Status | Recommended behavior | Priority | Complexity | Suggested automated test |
|---|---|---|---|---|---|---|
| `Psalms 8:3` | `src/search.ts` parses full book/chapter/verse references and searches the active filtered pack. | Working | Keep exact canonical matching. | P0 | Low | Search a known verse in an active pack. |
| `Psalm 8:3` | Alias table includes `ps`/`psa`, not singular `psalm`. | Partial | Normalize singular/plural and common aliases. | P0 | Low | Alias table regression tests. |
| `Ps 8:3` | `ps` is mapped to Psalms. | Working | Preserve and expand documented aliases. | P0 | Low | Existing alias plus additional aliases. |
| `ps8.3`, `psa8 3` | Parser expects a space before chapter and does not parse compact book/chapter forms. | Missing | Parse compact forms when unambiguous. | P0 | Medium | Compact syntax table tests. |
| `8:3`, `8.3`, `8 3` | No bare chapter/verse parser. | Missing | Resolve against active material; return candidates if ambiguous. | P0 | Medium | Ambiguous and unambiguous candidate tests. |
| Exact quotation | Quoted queries use normalized substring matching. | Working | Show exact phrase mode and match span. | P1 | Low | Case/punctuation phrase tests. |
| Partial quotation | Multiword queries use AND matching; quoted partials use containment. | Partial | Keep AND fallback and add explicit phrase mode. | P1 | Low | Middle/partial phrase tests. |
| Quotation beginning | `start:` and trailing `*` select verse-start mode. | Partial | Add visible syntax/help and a button or filter for “starts with.” | P1 | Low | Start match and non-start rejection. |
| Quotation ending | No ending mode exists. | Missing | Add `end:` or a dedicated ending filter. | P1 | Low | Ending phrase tests. |
| Out-of-order words | Multiword search requires all terms but does not require order. | Working | Display the matched terms and preserve predictable ranking. | P1 | Low | Reordered-term tests. |
| Punctuation/case differences | Case and some quote marks are normalized; punctuation is not governed by a shared tokenizer. | Partial | Use one deterministic tokenizer for phrase and word modes. | P1 | Medium | Punctuation/tokenization fixtures. |
| Minor spelling mistakes | No fuzzy matching. | Missing | Optional bounded edit-distance suggestions, never silent replacement. | P2 | Medium | Suggestion and no-false-match tests. |
| One word / all matching verses | Word search returns matching verse rows. | Working | Add result count and exact-word toggle. | P1 | Low | Result-set tests. |
| Total occurrences | No occurrence counting. | Missing | Report total token occurrences separately from distinct verses. | P1 | Medium | Repeated-token fixture. |
| Distinct verse count | No count metric. | Missing | Report distinct matching references. | P1 | Low | Count differs from occurrence total. |
| Exactly once/twice/three times | No frequency mode. | Missing | Add exact frequency filters over the selected division’s full material. | P1 | Medium | 1x/2x/3x tests including repeats in one verse. |
| Shared word/phrase cross-reference | AND search can find co-occurrence in one verse only. | Partial | Add grouped related results and side-by-side comparison. | P1 | Medium | Shared-term grouping tests. |
| Matching beginnings/endings | Only verse-start exists; no cross-result grouping. | Partial | Add beginning/ending filters and related-result grouping. | P2 | Medium | Prefix/suffix group tests. |
| Consecutive verses containing a word | No adjacent-verse analysis or navigation. | Missing | Identify actual biblical neighbors and show runs. | P1 | Medium | Cross-chapter adjacency tests. |
| Previous/next verse | No relationship controls. | Missing | Add context actions using canonical biblical adjacency, bounded by pack coverage. | P1 | Medium | Neighbor resolution tests. |
| Chapter context | No context pane. | Missing | Optional split-pane/context drawer on desktop and inline context on mobile. | P2 | Medium | Context boundary tests. |
| Animals/body parts/places/names | No annotations or dictionaries in public schema. | Missing | Add reviewed, versioned annotation layers generated locally. | P2 | High | Annotation category fixtures. |
| Questions/exclamations | No punctuation annotation or search mode. | Missing | Tokenize punctuation and expose classification filters. | P2 | Medium | Question/exclamation tests. |

## Confirmed defects versus enhancements

Confirmed defects are incomplete reference syntax, the 999 range sentinel shown as infinity, missing actual pack maximums in range controls, and the absence of precise occurrence metrics. The absence of fuzzy, semantic, cross-reference, and annotation features is a product gap rather than a defect in the existing narrow search contract.

## Cross-cutting test requirements

Future search changes should test active division and study-range filtering, empty results, duplicate references, compact aliases, ambiguity, exact token boundaries, phrase punctuation, result ordering, and the distinction between biblical adjacency and study-number adjacency. Tests should use small deterministic fixtures and retain the public app’s no-network guarantee.

