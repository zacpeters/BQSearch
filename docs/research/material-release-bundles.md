# Material Release Bundles

The local Material Manager can generate a deterministic release ZIP after a unified Scripture pack has been reviewed and every included division has a valid analysis report.

## Bundle layout

```text
packs/<pack-id>-<version>.json
analysis/<pack-id>/Beginner.json
analysis/<pack-id>/Junior.json
analysis/<pack-id>/Intermediate.json
analysis/<pack-id>/Experienced.json
manifest.json
validation-report.txt
```

The paths for the pack and sidecars match the public application's static asset conventions. A maintainer can copy the approved files into the public repository without changing the pack or analysis schemas. The bundle itself is not automatically published or installed.

## Validation

Each sidecar is validated against the final pack ID, version, integrity checksum, division membership, verse IDs, annotation offsets, and analysis schema `1.1`. Missing reports, invalid annotations, checksum mismatches, duplicate outputs, import errors, and analysis validation errors block release export. Legitimate unresolved unique-boundary cases are retained as warnings.

The manifest includes pack identity, schema versions, division counts, relative paths, SHA-256 checksums, and source filenames. The validation report is human-readable and contains the same file checksums plus warnings and errors.

## Determinism

Pack and analysis JSON content is generated without release timestamps. ZIP entries are sorted, stored without compression, and use a fixed archive timestamp. Identical inputs therefore produce identical JSON content and ZIP bytes. The user may override the suggested download filename without changing bundle contents.

Individual pack and analysis JSON downloads remain available for troubleshooting. The bundle does not modify checked-in packs, public assets, IndexedDB, or GitHub settings.
