# UPCQuiz Live Score Integration Feasibility

Research date: 2026-11-04 (UTC request timestamps in the captured response headers)

Status: research only. No application, Scripture, Material Manager, deployment, or external UPCQuiz data was changed.

## Executive summary

The proposed compact, read-only scoreboard appears technically feasible only with a small same-origin server-side proxy (or another service that can add CORS headers). A browser script served from BQ Search's GitHub Pages origin cannot directly read the UPCQuiz HTML observed in this research: UPCQuiz did not return `Access-Control-Allow-Origin`, and it returned `X-Frame-Options: SAMEORIGIN`.

The scoresheet itself is simple server-rendered HTML. Team names and the current team totals are present as ordinary table cells. It also contains JavaScript that reloads the entire scoresheet every 60 seconds. The live directory is a JavaScript shell that loads `wait15.php` initially and then polls `livegames.php` approximately every 30 seconds. Those observations are verified for the captured pages; the exact behavior during an actively changing quiz should still be verified with a live event.

## 1. Confirmed findings with evidence

### Archived scoresheet

Requested URL:

`https://www.upcquiz.com/results/sheet.php?yr=26&id=T20260719020G1`

The request returned HTTP 200, `Content-Type: text/html; charset=UTF-8`, and an XHTML-style HTML document. The response included `X-Powered-By: PHP/7.0.33` and `X-Frame-Options: SAMEORIGIN`.

The response body contained the following rendered quiz data:

- Red team: `Missouri 3`; total: `170`
- Yellow team: `Texas 1`; total: `55`
- Quiz: `#1`; question: `#15`

The body also includes the round-by-round table and participant names. The page footer states that the page automatically refreshes every 60 seconds.

### Live directory

Requested URL:

`https://www.upcquiz.com/results/livenew.php`

The initial response returned HTTP 200 and the same `X-Frame-Options: SAMEORIGIN` header. Its HTML contains an empty `<div id="livegames"></div>` and these verified JavaScript calls:

```js
$("#livegames").load("wait15.php");
setInterval('autoRefresh_div()', 30000);
// autoRefresh_div loads: livegames.php?expire=30
```

The captured `wait15.php` response tells the browser to wait five seconds and then load `livegames.php?expire=20`; it also says live quizzes refresh every 20 seconds. At the time of the capture, `livegames.php?expire=30` returned the server-rendered message `There are no live quizzes at this time.`

These are page behaviors, not an assumed API. No public JSON API was discovered in the inspected HTML.

## 2. Actual request URLs and response formats

Observed requests:

| Purpose | URL | Observed format |
| --- | --- | --- |
| User-provided scoresheet | `https://www.upcquiz.com/results/sheet.php?yr=26&id=T20260719020G1` | Complete server-rendered HTML/XHTML, including tables and inline JavaScript |
| Live directory shell | `https://www.upcquiz.com/results/livenew.php` | HTML shell with scripts and empty `#livegames` container |
| Initial live-directory wait page | `https://www.upcquiz.com/results/wait15.php` | HTML plus inline countdown JavaScript |
| Live-directory content | `https://www.upcquiz.com/results/livegames.php?expire=30` | HTML fragment/document inserted into `#livegames`; captured response said no live quizzes |
| Live-directory content after wait page | `https://www.upcquiz.com/results/livegames.php?expire=20` | Referenced by the observed inline JavaScript; not treated as a separate undocumented API |

The scoresheet also contains a link to the graphical summary:

`http://www.upcquiz.com/results/graphics.php?yr=26&id=T20260719020G1`

That link was observed but was not needed for the proposed team-name/team-score display and was not used as an integration dependency.

## 3. Team-score extraction feasibility

Extraction is feasible from the scoresheet HTML without executing page JavaScript.

The first table has a header row containing the team names in cells shaped like:

```html
<tr>
  <td colspan="6" bgcolor="#FF6666">Missouri 3</td>
  <td class="tstyle2"> vs </td>
  <td colspan="6" bgcolor="#FFFF66">Texas 1</td>
</tr>
```

The same table contains the per-question scoring grid. The final summary table contains the compact totals in ordinary cells:

```html
<td bgcolor="#FF6666"><font color="black">170</font></td>
<td bgcolor="#FFFF66"><font color="black">55</font></td>
```

The summary row also identifies `Question #15`. The color conventions (`#FF6666` for red and `#FFFF66` for yellow) are useful observed markers, but they are presentational rather than a documented schema. A proof of concept should parse table structure and nearby text, validate numeric totals, and keep the extraction adapter isolated so markup changes do not affect BQ Search.

Verified fact: the requested archived page exposes names and totals in HTML.

Hypothesis requiring a live-event check: the same summary table is updated consistently at each score change while a quiz is in progress.

## 4. Server rendering, scripts, and live-update mechanism

The archived scoresheet's names, question rows, and totals were present in the initial HTTP response. No additional data request, AJAX call, JSON payload, iframe, or external script was present in the inspected scoresheet response. The only relevant script is an inline timer that calls `window.location.reload()` when its 60-second countdown expires. A manual `Refresh` button is also emitted by inline JavaScript.

The live directory is different: its shell uses jQuery `.load()` to fetch HTML from `wait15.php` and `livegames.php`. The directory's active-quiz discovery is therefore server-generated HTML polling, not a browser-visible JSON API.

The scoresheet update mechanism is whole-document polling at approximately 60 seconds. It is not a push stream or WebSocket. UPCQuiz itself warns that displayed information may not exactly match the live quiz because of connectivity issues.

No aggressive polling was performed. The research used one request per referenced page/auxiliary response plus header checks.

## 5. Browser/CORS and embedding findings

For the scoresheet request with:

```http
Origin: https://zacpeters.github.io
```

the response still had no observed `Access-Control-Allow-Origin` header. An `OPTIONS` request with `Origin` and `Access-Control-Request-Method: GET` also returned HTTP 200 HTML without CORS response headers. This is evidence that a browser `fetch()` from BQ Search's GitHub Pages origin would be blocked by CORS. A command-line request succeeding does not bypass that browser policy.

The inspected UPCQuiz pages returned:

```http
X-Frame-Options: SAMEORIGIN
```

Therefore a cross-origin iframe from `https://zacpeters.github.io` should be blocked by the browser's framing policy. No `Content-Security-Policy: frame-ancestors` header was observed, but the `X-Frame-Options` result is already sufficient to rule out relying on a cross-origin iframe for the scoreboard.

The GitHub Pages origin responded successfully and included `Access-Control-Allow-Origin: *` for its own static page. That does not grant BQ Search permission to read UPCQuiz; CORS is controlled by the target UPCQuiz response.

## 6. Direct-fetch versus proxy comparison

### Direct browser fetch from GitHub Pages

Not viable based on the captured headers. The target response lacks CORS permission. It would also require parsing an HTML document whose markup is not an API contract. The GitHub Pages site is static and cannot add a server-side relay at request time.

### Cross-origin iframe

Not viable as the primary design. `X-Frame-Options: SAMEORIGIN` should prevent embedding UPCQuiz in BQ Search. Even if framing were permitted in the future, an iframe would not provide a clean compact scoreboard or reliable cross-document access.

### Small read-only proxy

Technically viable. A same-origin BQ Search backend or edge function could accept only validated UPCQuiz scoresheet URLs/identifiers, fetch the upstream HTML server-side, extract the two team names and totals, and return a small normalized JSON response. The proxy would need caching, a conservative polling limit, upstream timeout/error handling, and an allowlist limited to the UPCQuiz results host and expected path/query shape.

This is an architectural conclusion from the observed CORS and embedding headers, not evidence that UPCQuiz provides or endorses a proxy endpoint.

## 7. Proposed minimal architecture

For an initial implementation after this research:

1. Keep BQ Search unchanged unless the user explicitly enables a collapsible “Live score” panel.
2. Accept and validate a pasted HTTPS scoresheet URL. Restrict the host to `www.upcquiz.com` and the path to `/results/sheet.php`; do not follow arbitrary URLs.
3. Send the URL or its validated `yr`/`id` values to a small same-origin read-only proxy.
4. Have the proxy fetch the HTML, parse only the summary table's two team labels and numeric totals, and return a normalized object such as `{ teams: [{ name, score }, ...], fetchedAt }`.
5. Poll conservatively at about 60 seconds, matching the scoresheet's observed refresh period, with backoff on failures. Stop polling immediately when the user stops following the quiz or leaves the panel.
6. Display only team names, scores, a last-updated time, and a compact error/stale indicator. Do not expose participant names or round-by-round scoring in the first version.
7. Treat a live-directory discovery feature as a separate, optional follow-up. It would require the proxy to fetch `livenew.php`/the observed auxiliary HTML, parse active scoresheet links, and apply tighter rate limits.

No new client dependency is required in principle; the main uncertainty is the server-side runtime/hosting for the proxy, not HTML parsing.

## 8. Risks and limitations

- UPCQuiz markup is legacy XHTML/HTML and uses presentational colors/classes rather than a documented machine-readable schema.
- A team name or score could be changed in markup without notice; extraction needs validation and monitoring.
- The 60-second reload means the displayed score can be stale, and the site explicitly warns about connectivity discrepancies.
- Scoresheet URLs may represent completed quizzes as well as active quizzes; the UI must label the data as last fetched rather than imply real-time guarantees.
- The live directory has multiple timing layers (`wait15.php`, 5-second countdown, 20/30-second content refresh), so discovery timing should not be hard-coded as an undocumented contract.
- CORS and framing currently prevent a pure GitHub Pages client-only solution.
- A proxy creates operational responsibilities: rate limiting, caching, abuse prevention, upstream failures, and possible terms-of-service/permission review.
- The provided archived sample is dated 2026-07-19 and was completed when fetched; it verifies structure, not in-quiz mutation behavior.

## 9. Recommendation for an initial proof of concept

Proceed only with a server-backed proof of concept, and keep it out of the core search path. The POC should use one known scoresheet URL, fetch it no more often than once per minute, parse the two summary team cells, and show a collapsible read-only card with a stale/error state. Validate it against several completed scoresheets and at least one genuinely active quiz before adding live-quiz discovery.

Do not build the POC around direct browser `fetch()` or an iframe unless UPCQuiz later adds explicit CORS/framing support.

## Missing live-event evidence and precise DevTools collection steps

The research verified the archived page and the directory's captured polling structure, but it did not observe a score changing during an active quiz. To collect that missing evidence during a live event:

1. Open the exact scoresheet URL in Chrome or Edge.
2. Open DevTools → Network, enable “Preserve log,” disable cache, and filter to `sheet.php`.
3. Record the initial document request URL, status, response headers, and response body/Preview. Confirm whether a second document request appears about 60 seconds later.
4. In Elements, inspect the summary table after each reload. Record the exact team-name cells, total-score cells, attributes/classes, and whether the values change without a full navigation.
5. In the live directory, open DevTools → Network, reload `livenew.php`, and record the requests for `wait15.php` and `livegames.php` including their full query strings and response bodies.
6. During an active quiz, compare two successive scoresheet document responses and note whether only the HTML changes or whether any additional XHR/fetch/WebSocket request appears.
7. From a page served at `https://zacpeters.github.io/BQSearch/`, run this in the Console:

```js
fetch('https://www.upcquiz.com/results/sheet.php?yr=26&id=T20260719020G1', { mode: 'cors' })
  .then(r => ({ status: r.status, type: r.type, headers: [...r.headers] }))
  .then(console.log)
  .catch(console.error)
```

Record the console error and Network response headers, especially `Access-Control-Allow-Origin`, `X-Frame-Options`, and any redirect. To test framing, create a temporary blank local page or use DevTools' Console to inspect an iframe attempt; record whether the browser reports a refused frame load. These steps are for evidence collection only and do not claim that the integration is verified.
