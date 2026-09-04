// CAN THIS MACHINE RUN `osy test --pixels`? — one JSON line, and nothing else.
//
// ⭐ WHY A PROBE RATHER THAN "TRY IT AND SEE". Booting a local platform, compiling the app and seeding its fixtures
//    happens BEFORE the first UI command reaches a browser — so a missing browser surfaces a minute in, as a stack
//    trace from a library the author has never heard of, after work they now have to repeat. Asking first costs
//    about a second and turns that into a sentence they can act on.
//
// ⛔ THERE ARE THREE DISTINCT FAILURES HERE AND THEY NEED DIFFERENT REMEDIES — which is the whole reason this file
//    exists instead of a `try { import } catch`:
//      · the `playwright` PACKAGE is not installed          → install the package
//      · it is installed but there is no browser to drive   → install Chrome, or download Playwright's own
//      · it launches fine                                   → nothing to say
//    Collapsing them into "playwright is unavailable" would send someone to `npm i playwright` when what they are
//    missing is a browser, which is the shape of unhelpful diagnostic this platform keeps measuring.
//
// Prints exactly one line of JSON to stdout: { ok, code, detail }. `code` is for the caller to branch on; `detail`
// is the library's own words, which are worth carrying because they name the actual path that failed.

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  console.log(JSON.stringify({ ok: false, code: 'no-package', detail: String(e?.message ?? e) }));
  process.exit(0);
}

// ⚠ THE SYSTEM CHROME FIRST, and that ordering is deliberate: it is what the repo's own visual harness uses
//   (`channel: 'chrome'` — no browser download), so a machine that can already run our visual suite can run this
//   with nothing further installed. Playwright's own bundled chromium is the fallback, not the first ask, because
//   downloading a browser is a much bigger thing to require of someone who has Chrome sitting right there.
for (const opts of [{ channel: 'chrome', headless: true }, { headless: true }]) {
  let browser;
  try {
    browser = await chromium.launch(opts);
    console.log(JSON.stringify({ ok: true, code: opts.channel ? 'system-chrome' : 'bundled-chromium', detail: '' }));
    await browser.close();
    process.exit(0);
  } catch (e) {
    var last = String(e?.message ?? e);
  } finally {
    try { await browser?.close(); } catch { /* a browser that never launched has nothing to close */ }
  }
}

console.log(JSON.stringify({ ok: false, code: 'no-browser', detail: last ?? '' }));
