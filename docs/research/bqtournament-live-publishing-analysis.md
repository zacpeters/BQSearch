# BQTournament Live Publishing Analysis

Research date: 2026-11-04

Scope: read-only inspection of the local BQTournament 2027 installation/decompiled source and the existing BQ Search repository. BQTournament was not launched, built, or modified. No authenticated request, database connection, upload, or score publication was attempted.

Source inspected: `/Users/zacpeters/Desktop/BQTournament 2027/bqtourn-decompiled`, the directory supplied for this investigation. It is apparently decompiled from `BQTournament27.app` version 8.6.0. Because this is decompiled output, line numbers below refer to the decompiled files and a few compiler/decompiler artifacts may not exactly match the original source.

## 1. Executive summary

BQTournament's live quiz path is substantially more immediate than the public scoresheet's 60-second browser reload suggests.

When the quizmaster/coordinator enables Live, each scoring/status event starts an asynchronous Java thread that updates two remote PostgreSQL tables: `livefeed` for team names, totals, question number, status, and timestamp; and `livesheet` for a serialized per-question scoresheet string. The application does not use a timer, debounce, or event queue for this path. The update is attempted after each relevant event, subject to the UI's Live state and the existing database connection.

The public UPCQuiz scoresheet is then a separate server-side rendering layer. The inspected source does not establish how quickly UPCQuiz turns database changes into public HTML, nor whether a cache sits in front of it. The only verified viewer-side behavior is the scoresheet's approximately 60-second full-page reload.

Therefore BQ Search could plausibly show changes faster than the normal public page by polling the public scoresheet through a conservative proxy more frequently than 60 seconds. A 5–15 second end-to-end experience is plausible if server availability is prompt, but not proven. The source does not provide evidence for a supported public JSON endpoint or a safe read-only route into the private PostgreSQL database. BQ Search should not use the database credentials or write-side protocol.

Recommended initial architecture: a strict, same-origin read-only proxy that fetches the public scoresheet HTML, caches it briefly, extracts only the two team names and totals, and exposes normalized JSON to an optional collapsible BQ Search panel. Start with approximately 15-second viewer polling, back off on failures, and show stale timestamps. Do not attempt direct database access or BQTournament-local integration for remote viewers.

## 2. Evidence classification

| Classification | Findings |
| --- | --- |
| Verified directly from source code | Java Swing desktop application; `bqtournament.BQTournamentApp` is the main class; PostgreSQL JDBC is used for UPCQuiz live state; Apache Commons Net FTP is used for files/backups; `GamePanel` and `AbleGamePanel` calculate scores and contain the live-feed threads; Live writes `livefeed` and `livesheet` after status/scoring events; public identifiers use tournament file name plus `G` plus game number. |
| Inferred from implementation | UPCQuiz's public HTML is generated from the `livefeed`/`livesheet` database state; a successful SQL update should be available to the public renderer before a 60-second viewer reload; no event queue or scheduled publisher exists for the per-question path. |
| Requires testing against UPCQuiz | Database commit-to-public-HTML latency; whether public HTML is cached; whether `sheet.php` reflects the `livesheet` update immediately; behavior when two asynchronous updates overlap; whether all live score changes are reflected in the same public summary cells. |
| Not supported by available evidence | A public JSON API; a documented read-only database interface; a public WebSocket/SSE feed for spectators; a supported way for BQ Search to bypass the public HTML; guaranteed sub-5-second public availability; a BQTournament HTTP upload endpoint for live scores. |

## 3. Source-code architecture

### Language and framework

- Java desktop application using Swing/AWT.
- Main class: `bqtournament.BQTournamentApp` (`BQTournamentApp.java:1187-1197`).
- Packaged app metadata identifies Java 11 as the minimum runtime and the executable's main class as `bqtournament.BQTournamentApp`.
- The inspected source is not a web server. It has no server-side HTTP framework or local API listener.

### Major live-relevant modules

| Module | Role | Relevant evidence |
| --- | --- | --- |
| `BQTournamentApp` | Application lifecycle, coordinator/live-feed preference, remote DB connection, full/live publishing actions, FTP backup/posting | `BQTournamentApp.java:603-689`, `733-801`, `1106-1185`, `1548-1982`, `3000-3073`, `4327-4385`, `4739-5004` |
| `GamePanel` | Standard quiz scoring UI, score calculation, Live checkbox, per-event live update threads | `GamePanel.java:1790-2120`, `2390-2484`, `4211-4246`, `6394-6550`, `8494-8630` |
| `AbleGamePanel` | Alternate/expanded quiz UI with a parallel live-feed implementation | `AbleGamePanel.java:4079-4114`, `6190-6315`, `8270-8410` |
| `Quiz` / `Question` | In-memory quiz state and compact scoresheet encoding | `Quiz.java:107-114`, `Question.java:229-270` |
| `Tournament` | Tournament identity and a limited live-result merge operation | `Tournament.java:93-99`, `201-205`, `472-520` |
| `Matrix` / `MatrixImage` | Tournament matrix and public live-matrix assets/QR URL | `Matrix.java:6214-6248`, `MatrixImage.java:515-524` |
| `GameBackupUtil` | Local JSON snapshots and completed-game server backups | `GameBackupUtil.java:62-160` |
| `UPCQuizProgram` / `QuizProgram` | UPCQuiz host, database selection, FTP configuration and role-gated credentials | `UPCQuizProgram.java`, `QuizProgram.java` |

### Networking libraries and transports

- PostgreSQL JDBC (`org.postgresql.Driver`, `DriverManager`) is the live-state transport.
- Apache Commons Net `FTPClient` uploads images, tournament files, and session backups.
- `java.net.URL`/`URLConnection` is used for license verification, not live scores.
- OkHttp and Socket.IO appear in `GamePanel`/`AbleGamePanel` for virtual-buzzer/quiz-room features. The inspected live-score path does not use those sockets.
- No local HTTP server, WebSocket server, TCP/UDP spectator broadcast, or browser-facing API was found.

## 4. Scoring-event-to-publishing call chain

The important standard-quiz path is:

1. A quizmaster marks a response/control such as `r1cBox`, `r1eBox`, `y1cBox`, `y1eBox`, a contest, timeout, or no-response in `GamePanel`.
2. The selected `Question` is mutated, for example `setr1c`, `setr1e`, `sety1c`, or `sety1e` (`GamePanel.java:1803-2030`).
3. The handler advances the question or recalculates sums. `calculateSums()` reconstructs `redSum` and `yelSum` from the question flags, bonuses, fouls, and response values (`GamePanel.java:6394-6526`).
4. The handler calls `updateStatus(...)` with the event description. Examples are `GamePanel.java:1824-1825`, `1848-1849`, `1872-1873`, `1894-1898`, `1980-1981`, and `2028-2029`.
5. `updateStatus()` stores the status, updates the UI, and calls `doLiveFeed()` (`GamePanel.java:4211-4215`).
6. If the Live checkbox is selected, `doLiveFeed()` starts either `ConnectLiveFeedThread` when the connection is marked failed, or `LiveFeedThread` otherwise (`GamePanel.java:4217-4233`).
7. `LiveFeedThread.run()` executes two SQL updates (`GamePanel.java:8552-8576`): one updates the current row in `livefeed`; the other updates the corresponding `livesheet` row with `quiz.getScoresheetCodes()`.
8. Each thread is started asynchronously. The UI thread does not wait for the database update to finish (`GamePanel.java:4224-4225`).

The alternate `AbleGamePanel` repeats the same pattern with parallel class-local thread implementations (`AbleGamePanel.java:4079-4114`, `8300-8344`).

### End-of-quiz path

When a quiz ends, `GamePanel.endQuizAction()` sets `quizSummary` totals and winner state, starts `UpdateLiveResultsThread` if Live is enabled, saves the local quiz, writes a local JSON snapshot, and starts an asynchronous `GameBackupUtil.uploadGameBackupToServer(...)` thread (`GamePanel.java:4450-4499`). The end-of-quiz live update changes the status/winner and related tournament/live rows (`GamePanel.java:8579-8630`), while the backup is a separate database record.

## 5. Where scores are calculated and stored

### In memory

`GamePanel` keeps the working totals in `redSum` and `yelSum`. `calculateSums()` rebuilds them by scanning `Quiz.questions` and applying:

- base question values;
- correct and error flags;
- fouls and interruption flags;
- team bonuses;
- quiz-out and lock logic.

The persistent per-question source is the `Question` array in the `Quiz` object. `Quiz.getScoresheetCodes()` concatenates the nonblank `Question.getCode()` values (`Quiz.java:107-114`). Each code encodes question number/value/type, contests, foul/no-response flags, responder indexes, interruption/correct/error/foul bits, and both teams' responder fields (`Question.java:229-270`).

### Remote live state

The source writes the following logical records through SQL statements. The exact column types/schema are not included in the inspected source, so the shapes below are derived from the insert/update argument order.

| Table | Source-written fields/meaning | Source locations |
| --- | --- | --- |
| `livefeed` | tournament display name, game number, red/yellow team short names, red/yellow current totals, question number, action/status, timestamp | `GamePanel.java:8506-8507`, `8560`; `BQTournamentApp.java:1591-1605`, `1731-1745` |
| `livesheet` | public scoresheet ID, compact serialized `scores` string, timestamp | `GamePanel.java:8512-8524`, `8561`; `Quiz.java:107-114` |
| `livegame` | public/game identifier, tournament name, game number, bonus settings, quiz-out setting, team names, live-team strings, timestamp | `GamePanel.java:8521-8524`; `BQTournamentApp.java:1615-1622` |
| `livetourney` | tournament display name, tournament numeric ID, team count, optional round-robin marker | `BQTournamentApp.java:691-703`, `GamePanel.java:8508-8510` |
| `images` | matrix image metadata and generated web-matrix message/mapping content | `BQTournamentApp.java:705-730`, `GamePanel.java:8603-8616`, `Matrix.java:6214-6248` |
| `game_backups` | completed-game JSON snapshot, tournament name, game number, save timestamp | `GameBackupUtil.java:62-126`, `147-159` |

The public-facing score is therefore not an individual event payload. It is a current state representation: totals and status in `livefeed`, plus the serialized question-level score state in `livesheet`.

## 6. Publishing triggers and frequency

### Per-event publishing

Verified directly: there is no per-event timer. A scoring/status action calls `updateStatus()`, and `updateStatus()` calls `doLiveFeed()`. If Live is selected and the connection is healthy, a new `LiveFeedThread` is started immediately. The thread issues the two SQL updates once.

This means the intended trigger is after each scored/status event, not once per minute and not only when a quiz ends.

### Initial connection and synchronization

When a scoresheet is built with Live selected and the coordinator check succeeds, `ConnectLiveFeedThread` is started (`GamePanel.java:1675-1679`). It opens the DB connection, initializes the current `livefeed`, `livegame`, and `livesheet` rows, and may call `BQTournamentApp.updateLiveDataSilent()` after counting live games (`GamePanel.java:8494-8548`).

`updateLiveDataSilent()` is a broader synchronization operation. It generates a tournament matrix image, uploads a GIF and backup file over FTP, and rewrites live/tournament/image state through the database (`BQTournamentApp.java:1824-1982`). It is not the normal per-question path.

### Full and completed-results posting

- `PostToWebThread` performs a larger coordinator-only website publication: FTP assets/files, database tournament/statistics/image rows, then `updateLiveData()` (`BQTournamentApp.java:4739-5004`).
- `PostLiveGamesAction` manually invokes `updateCompletedLiveData()` for completed live games (`BQTournamentApp.java:3050-3073`, `4542-4560`).
- These are separate from the automatic current-quiz `LiveFeedThread` updates.

### Timer, debounce, queue, and concurrency findings

- No timer controls the normal live score writes.
- No debounce or throttle was found.
- No pending-update queue or durable retry queue was found.
- Each event creates a thread; the source does not show synchronization around successive `LiveFeedThread` instances. Very rapid events could therefore overlap at the database level.
- The update itself is asynchronous from the Swing event handler's perspective.

## 7. Failure handling, pause behavior, and Live controls

### Connection failures

`LiveFeedThread` catches `SQLException`, marks the Live checkbox background red, closes the statement/connection, and sets the stored statement reference to null (`GamePanel.java:8563-8575`). It does not persist an unsent event for later retry.

On a later `doLiveFeed()` call, the red state causes `ConnectLiveFeedThread` to attempt a fresh connection and reinitialize the live rows. This is opportunistic reconnection, not a replay of every missed event. SQL failures are logged; no bounded retry count or backoff schedule is visible.

The end-of-quiz `game_backups` insert also catches `SQLException` and logs that the server backup was skipped (`GameBackupUtil.java:147-159`). It does not retry.

### Pause behavior

No background publishing timer was found. If the quiz is paused and no scoring/status action occurs, the normal live writer does not continue sending heartbeats or snapshots. A subsequent score, contest/status change, timeout, or similar event can trigger another update.

### What the Live button controls

The per-scoresheet `Live` checkbox is the direct gate for live score publishing. When turned on, it checks coordinator status, sets the live preference, and starts `ConnectLiveFeedThread`; when turned off, it marks the connection failed, stores `live=false`, closes the active DB resources, and sets `backupPref=false` (`GamePanel.java:2426-2483`).

The application-level “Live Feed & Backup” setting also controls coordinator-only menu state and session backups (`BQTournamentApp.java:1106-1185`, `4327-4385`). In practice, the user-facing feature couples live publishing with backup behavior, but the score rows and backup files are distinct channels.

## 8. Network destinations and payload structures

All sensitive values are intentionally omitted. The source contains embedded credential material; it was not copied into this report. That is a security concern for the upstream application, but it is not a usable or appropriate integration mechanism for BQ Search.

### Remote PostgreSQL

Source-selected destination:

- Host: `qstat.upcquiz.com`
- Port: `5432`
- Protocol/library: PostgreSQL JDBC
- Database: the UPCQuiz tournament database configured by `UPCQuizProgram`
- Authentication: source-managed coordinator/read-only/read-write database credentials; values redacted

Connection construction is in `BQTournamentApp.getDatabaseConnection()` (`BQTournamentApp.java:733-775`). It attempts read/write versus read-only accounts in a fallback pattern and also has a separate UPCQuiz connection helper (`BQTournamentApp.java:777-801`) for coordinator/license status. BQ Search must not reuse these credentials or connect to this database.

The per-event “payload” is SQL state mutation, not HTTP:

- `UPDATE livefeed` with current team totals, question number, status, and time.
- `UPDATE livesheet` with the complete compact score-code string and time.

The initial/live setup also performs `DELETE` plus `INSERT` operations for `livefeed`, `livegame`, `livesheet`, and `livetourney`.

### FTP

Source-selected destination:

- Host pattern: `ftp.<configured quiz-program server>`
- Protocol/library: FTP via Apache Commons Net
- Directories used for live matrix/assets: `public_html/results/images`
- Directories used for session backups: `public_html/results/sessions`
- Authentication: configured FTP credentials; values redacted

`updateLiveDataSilent()` uploads a generated tournament GIF and a serialized tournament backup file (`BQTournamentApp.java:1834-1859`). Session backup code uploads `.bqf` files (`BQTournamentApp.java:4327-4385`). This is not the per-question score transport.

### HTTP

The source contains a license-verification request to a UPCQuiz PHP URL and other non-score web operations. No HTTP POST or PUT endpoint was found for per-question live scores.

The source generates a public live-matrix QR URL of this shape (`MatrixImage.java:515-524`):

`https://www.<quiz-program-server>/results/mat2.php?id=<tournament-oid>&yr=<two-digit-year>`

This is a public display URL, not a documented data API.

### Network-operation matrix

| Operation | Transport/method | Request or payload | Response/error evidence |
| --- | --- | --- | --- |
| Current live score update | PostgreSQL JDBC; no HTTP method | SQL `UPDATE` of `livefeed` and `livesheet`; the latter carries the complete compact scoresheet-code string | `executeUpdate()` returns an affected-row result or throws `SQLException`; no JSON/XML response is handled; no explicit transaction, retry, or statement timeout is configured in this path |
| Initial live registration | PostgreSQL JDBC; no HTTP method | `DELETE`/`INSERT` for `livefeed`, `livegame`, `livesheet`, and sometimes `livetourney` | SQL success/failure; a failure marks the local Live control red and closes the connection (`GamePanel.java:8536-8548`) |
| Live matrix/backup asset sync | FTP binary transfer | Generated `T<OID>.gif` and a serialized backup file under the remote `public_html/results/images` directory | FTP reply code and `storeFile` boolean are checked inconsistently; `IOException` is logged; no automatic retry loop is present (`BQTournamentApp.java:1834-1873`) |
| Session backup | FTP binary transfer | Tournament `.bqf` file under `public_html/results/sessions` | Success/failure is reflected in the UI; no retry queue (`BQTournamentApp.java:4327-4385`) |
| Completed-game backup | PostgreSQL JDBC prepared statement | JSON snapshot inserted/upserted into `game_backups` | SQL success or logged `SQLException`; no retry (`GameBackupUtil.java:147-159`) |
| Full website posting | FTP plus PostgreSQL JDBC | Matrix assets/files over FTP; tournament/statistics/image rows over SQL | Coordinator-gated UI, server/database errors, and success/failure dialogs; not a per-event upload (`BQTournamentApp.java:4739-5004`) |
| Public viewer retrieval | Not implemented by BQTournament source | The source only constructs the public live-matrix URL; it does not issue a scoresheet GET | Prior read-only UPCQuiz inspection found server-rendered HTML, no observed CORS allowance, and `X-Frame-Options: SAMEORIGIN`; those are UPCQuiz observations, not BQTournament source behavior |

No `Content-Type` header or HTTP request body is generated for the per-question live path because that path is SQL over JDBC. The public scoresheet and live-directory response formats were verified separately as HTML: the scoresheet is a complete rendered HTML document, while `livenew.php` loads HTML from `wait15.php` and `livegames.php`. The relevant observed refresh intervals are approximately 60 seconds for the scoresheet and 30 seconds for the live-directory shell; they are server/page behavior, not BQTournament publishing timers.

### Local JSON backup

`GameBackupUtil.buildGameJson()` creates a complete completed-game JSON snapshot with tournament file name, game number, timestamp, team names, final totals, winner, individual scores, and question-level fields (`GameBackupUtil.java:62-126`). The file is written under the local completed-quizzes directory and, after quiz end, may be inserted into `game_backups`. It is not a live public spectator endpoint.

## 9. Existing spectator and scoreboard capabilities

The source contains several display/export capabilities:

- Local Swing scoresheet and optional second-monitor “BQTournament Summary Display” (`GamePanel.java:2489-2500` and parallel `AbleGamePanel` code).
- Generated tournament matrix images, interactive web-matrix messages, mappings, and a QR code to the public live matrix (`Matrix.java:6214-6258`, `MatrixImage.java:515-524`).
- FTP-uploaded tournament GIF/PDF/backup files and server-rendered tournament results.
- Local `.bqf` files, exported tournament data, session backups, and completed-game JSON snapshots.
- `Tournament.getLiveUpdates()` reads remote `livefeed` rows to merge winner information into a local tournament (`Tournament.java:472-520`). This is a database-backed coordinator/client feature, not a public browser API.

No local HTTP endpoint, WebSocket spectator service, TCP/UDP score broadcast, shared-memory interface, or documented external integration API was found.

The virtual-buzzer Socket.IO code is unrelated to remote public score display. It should not be treated as a reusable spectator feed without separate protocol and authorization evidence.

## 10. Live quiz identifiers and public URL construction

### Tournament identifier

`Tournament.getOIDstring()` concatenates:

`<YYYYMMDD><quiz type><quiz level><district id>`

(`Tournament.java:93-99`). `getFileName()` returns `T` plus that numeric OID (`Tournament.java:201-205`). For example, the reference scoresheet's `T20260719020` portion is consistent with this source-generated tournament file name pattern.

### Quiz identifier

The per-quiz ID is constructed as:

`<tournament-file-name>G<quiz.gamenum>`

This is visible in `GamePanel.ConnectLiveFeedThread` (`GamePanel.java:8512-8524`) and repeated in the live update methods. The reference URL uses `id=T20260719020G1`, matching that pattern.

### Year parameter

The public scoresheet URL includes a two-digit `yr` query parameter. The source explicitly derives a two-digit year for the live matrix QR URL from the tournament OID (`MatrixImage.java:515-524`). The source does not construct the `sheet.php` URL directly, so the exact public scoresheet route is established by the reference page and observed UPCQuiz behavior, not by a direct BQTournament call.

### Discovery

BQTournament knows the local tournament OID and current game number, but it does not expose a public discovery API. The source writes `livetourney` and `livegame` rows that UPCQuiz's live directory can use, and the prior page investigation verified that `livenew.php` loads server-generated live HTML via `wait15.php` and `livegames.php`. The source alone cannot prove the directory's complete selection/filter rules or provide a supported alternative to that public directory.

## 11. Realistic near-real-time update potential

There are three separate latency stages.

### A. Publishing latency: scoring event → BQTournament transmission

Source evidence indicates an immediate asynchronous attempt after each relevant event:

`score control → updateStatus → doLiveFeed → new LiveFeedThread → SQL UPDATE livefeed/livesheet`

There is no scheduled one-minute publisher. The likely local delay is the Java thread start, JDBC connection/statement execution, and database commit. The source does not measure this delay or configure a statement timeout in the live thread.

### B. Server availability latency: database update → public UPCQuiz HTML

Unknown from available source. The source writes database rows directly, but it does not include UPCQuiz's PHP renderer, cache configuration, commit acknowledgment semantics, or replication path. The public scoresheet's observed 60-second timer is a viewer refresh instruction, not proof that server data updates only once per minute.

### C. Viewer refresh latency: public HTML change → BQ Search

The prior UPCQuiz investigation verified a full scoresheet reload approximately every 60 seconds and no CORS permission for direct browser fetches. A proxy can fetch more often than that page's built-in timer, but must respect UPCQuiz infrastructure.

### Practical bands

| Target | Assessment |
| --- | --- |
| 1–5 seconds | Possible only if the proxy polls very aggressively and UPCQuiz renders immediately; not recommended or proven. The source does not establish this end-to-end latency. |
| 5–15 seconds | Plausible with a proxy polling around 10–15 seconds, assuming public HTML reflects the DB promptly. Requires live-event testing and conservative rate-limit review. |
| 15–30 seconds | Realistic initial target with one proxy cache per quiz and viewer polling against the proxy. Less upstream load and more compatible with the site's existing live-directory cadence. |
| Approximately 60 seconds | Guaranteed baseline from the existing public page's own reload behavior; no proxy is needed, but updates feel stale. |

The strongest supported conclusion is: the source removes a presumed one-minute publishing bottleneck, but it does not remove the need to measure public server availability and to design respectful proxy polling.

## 12. Integration approach comparison

| Approach | Latency | Reliability | Complexity/hosting | Security and compatibility | Assessment |
| --- | --- | --- | --- | --- | --- |
| A. Public scoresheet through proxy | 15–30 seconds initially; potentially 5–15 with evidence | Depends on HTML stability and UPCQuiz availability | Small edge/server function; cache and parser required | Works with GitHub Pages; no credentials; depends on markup | Best first option and closest to the existing public contract |
| B. Existing read-only public endpoint | Unknown | No such endpoint found in source or inspected pages | Low if it existed | Ideal, but unsupported by evidence | Do not assume or build against one |
| C. Reuse publishing protocol/database | Potentially very low | Requires private network/database access and credentials | High; backend security and authorization required | Not suitable for anonymous remote viewers; risks exposing write-side access | Reject for BQ Search |
| D. Local BQTournament interface/export | Near immediate on the tournament computer | Depends on local machine and operator | Requires a relay, public ingress, or manual export | Not usable for an arbitrary remote viewer without extra infrastructure | Useful only for a future operator-controlled relay |
| E. Local/remote scoreboard file | Near immediate if shared | File sharing and synchronization required | Additional exporter/host required | Not available to GitHub Pages by itself | No existing supported interface found |

A Cloudflare Worker is a reasonable implementation of Approach A if the project later chooses that hosting, but the source investigation does not make Cloudflare specifically necessary. Any equivalent same-origin/edge proxy is acceptable.

## 13. Recommended architecture

Use a read-only public-HTML proxy, not the BQTournament database protocol.

### Proxy contract

- Accept either a validated scoresheet URL or validated `yr`/`id` components.
- Allow only `https://www.upcquiz.com/results/sheet.php` as the upstream route.
- Reject arbitrary hosts, ports, schemes, path traversal, redirects to other hosts, and unrecognized query shapes.
- Fetch upstream HTML server-side with a short timeout and a bounded response size.
- Cache one normalized result per exact quiz ID for approximately 10–15 seconds initially; increase the interval if testing shows no benefit or UPCQuiz asks for lower frequency.
- Parse only team labels and team totals from the observed summary table. Do not expose participant names, individual scores, or the serialized scoresheet in the first POC.
- Return `{ teams, fetchedAt, upstreamStatus, stale, error }` or an equivalent normalized shape.
- Configure CORS only for the BQ Search deployment origin, or make the proxy same-origin with the app.
- Never forward credentials, cookies, arbitrary request headers, or upstream write capabilities.
- Use stale-while-revalidate behavior and clear error states so a temporary upstream failure does not erase the last known score.

### BQ Search behavior

- Keep the scoreboard disabled by default and collapsible.
- Let the user paste a known scoresheet URL.
- Poll the proxy only while the panel is active and stop immediately when the user stops following.
- Display team names, totals, fetched time, and a stale indicator.
- Do not alter Scripture search, offline packs, Material Manager, or the main search layout.
- Consider live-directory discovery later as a separate feature using the already observed `livenew.php` HTML flow, not as an assumption that BQTournament's database tables are public API.

## 14. Remaining unknowns

1. Exact delay between a committed `livefeed`/`livesheet` update and the public `sheet.php` response changing.
2. Whether UPCQuiz uses application/page caching for scoresheets and, if so, the cache invalidation behavior.
3. Whether `livefeed` and `livesheet` updates are committed independently or within a transaction managed elsewhere.
4. Whether concurrent `LiveFeedThread` instances can produce an older update after a newer update.
5. Whether every status event that calls `updateStatus()` is intended to alter public totals or only public action text.
6. Whether the live directory exposes a stable active-quiz link/identifier structure across tournament formats.
7. Whether a current UPCQuiz operator permits automated public polling at the proposed interval.
8. The original, non-decompiled source and build configuration were not available in the supplied directory; this analysis is based on decompiled source and app metadata.

The safe way to resolve items 1–7 is a coordinated live-event observation using browser DevTools and, if needed, cooperation from a tournament operator. Do not connect to the private PostgreSQL service or exercise write endpoints.

## 15. Minimal proof-of-concept plan

Research/implementation boundary for a future phase:

1. Use one known completed scoresheet URL and confirm the proxy's strict allowlist/parser against the already inspected HTML.
2. Add no BQ Search UI yet; first test the proxy independently with cached, normalized output.
3. During an authorized live quiz, collect timestamps for a score event, the next public scoresheet change, and the proxy response. Use low-frequency polling and stop if the upstream operator requests it.
4. Validate at least one standard quiz and one alternate format, including a score correction or contest/status update if available.
5. Add a compact optional panel only after stale/error behavior, stop-following behavior, and parser validation are established.
6. Treat live directory discovery as a later, separately rate-limited experiment.

## Conclusion

Can BQ Search follow a UPCQuiz quiz and display updated team scores significantly faster than the existing 60-second public page refresh?

Yes, plausibly—but not by using BQTournament's private publishing connection. The source shows that BQTournament attempts to write current live state after each scoring/status event, without a one-minute publishing timer. If UPCQuiz's public renderer exposes those committed changes promptly, a read-only proxy polling the public scoresheet every roughly 10–15 seconds could make updated team totals visible well before the page's built-in 60-second reload.

That faster result is not yet fully verified because the source does not reveal UPCQuiz server-side rendering/cache latency. The defensible first architecture is therefore a strict cached proxy over the public scoresheet, with conservative polling, stale indicators, no credentials, no authenticated database access, and no assumptions about an undocumented API.
