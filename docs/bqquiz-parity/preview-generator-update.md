# Preview Generator deployment investigation

The live preview was serving the Step 5 build during this investigation. Its entry HTML, main bundle, quiz JavaScript and CSS, public catalog, and service worker matched a local build of `fede94c92fcdfea7d09e8ee9ffe5bccca99be16e` byte for byte. The local build used Node 22, `VITE_ENABLE_QUIZZES=true`, and `VITE_BASE_PATH=/BQSearch-Preview/`. The [Pages workflow](https://github.com/zacpeters/BQSearch-Preview/blob/main/.github/workflows/preview-pages.yml) specifies those settings, and the [observed deployment](https://github.com/zacpeters/BQSearch-Preview/actions/runs/44556430661) completed successfully.

## Route and assets

The host **Quizzes** action selects the lazy-loaded `QuizApp` in [App.tsx](../../src/App.tsx). Its **Generate Quiz** tab selects the single `QuizGenerator` imported by [QuizApp.tsx](../../src/features/quizzes/QuizApp.tsx). The [component](../../src/features/quizzes/generator/QuizGenerator.tsx) imports [its stylesheet](../../src/features/quizzes/generator/quiz-generator.css). A source search found one Generator component in the active application. Live `QuizApp-C2e1mNyj.js` contains the searchable picker, and live `QuizApp-CE4hkEKm.css` contains the workspace grid and eligibility row rules.

Two new browser contexts opened the [live preview](https://zacpeters.github.io/BQSearch-Preview/), one with service workers allowed and one with them blocked. Both loaded those quiz assets from the network and rendered the Step 5 picker, two columns at 1080 px, and the formatted eligibility summary shown in the [Step 5 reference](screenshots/generator-ipad-landscape.png).

## Reproduction and fix

1. Serve the previous revision `7350d65` and wait for the page to be controlled by its service worker.
2. Switch the same test origin to the Step 5 artifact and hold the service-worker update response while reloading. The controlled browser got the old precached HTML and ran `index-DjZui3Kg.js`. A fresh browser got `index-DdG_G1ps.js` and showed the new screen against the same server.
3. Release the update and wait for the new worker to take control. The open page continued running the old bundle until its next reload. The deployment had changed the files on the server, while the previous worker's cache-first navigation still selected the previous entry HTML.

The local fix keeps the existing service-worker URL, scope, automatic activation, and asset precache. Quiz-enabled builds revalidate document navigations online before consulting the precached app shell. When the network fails or times out, the worker serves the installed app shell and its matching offline assets. The feature-disabled build retains its existing worker configuration. The Generator, navigation, catalog, and IndexedDB contracts are untouched.

An already-installed legacy worker can still serve its cached page on the first navigation during rollout. Once the replacement worker activates, a normal reload uses the new policy. Open tabs retain their current state until navigation or reload. The test isolated the service-worker mechanism and did not inspect the reporter's browser storage.

## Evidence and validation

- [Before, reproduced with the previous worker controlling the first reload](screenshots/preview-generator-before.png)
- [After, local fixed preview with the picker open](screenshots/preview-generator-after.png)
- The [browser regression](../../tests/browser/preview-update.spec.ts) verifies that a controlling worker serves updated HTML on online reload at both the preview root and `index.html`, then serves the installed Generator and catalog offline.
- The fixed build preserves the application bundle hashes and the public catalog SHA-256. The artifact passed checks equivalent to the current workflow's path, allowlist, symlink, and credential checks.
- Node 22 validation passed all 157 unit tests, 30 feature-enabled browser tests, the feature-disabled browser test, pack validation, and preview, feature-disabled, and admin production builds.
