"use strict";
var OsyUiVerbs = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/lib/ui-verbs.mjs
  var ui_verbs_exports = {};
  __export(ui_verbs_exports, {
    createUiVerbs: () => createUiVerbs
  });
  function createUiVerbs({ dom, host }) {
    const perf = globalThis.performance;
    const monotonicNow = perf && typeof perf.now === "function" ? () => perf.now() : () => Date.now();
    const fromBase64Url = (s) => {
      const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
      if (typeof globalThis.atob === "function") {
        const bin = globalThis.atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }
      return globalThis.Buffer.from(s, "base64url").toString("utf8");
    };
    const {
      scopeRoot,
      resolveWithin,
      dialogNameOf,
      withinBaseDescription,
      openDialogName,
      recordInteraction,
      interactionResolved,
      scopeNote,
      readableTexts,
      reachableTexts,
      collapse,
      canonicalProbeValue,
      candidates,
      mimeFor,
      accessibleName,
      keyCodeFor,
      rowName,
      renderedRows,
      rowsNamed,
      isFieldElement,
      describeCandidates,
      vanishedNote,
      vanishedEarlierNote,
      disjointDeepest,
      candidateCoordinate,
      byText,
      findByAriaLabel,
      clickableFor,
      clickable,
      clickTargetOf,
      fields,
      fieldFor,
      fieldNames,
      noOptionRefusal,
      noFieldRefusal,
      parsePickerValue,
      comboTriggerFor,
      comboScopeOf,
      datesOn,
      comboKindOf
    } = dom;
    const histBack = [];
    const histFwd = [];
    let current = null;
    let softDepth = 0;
    let softFwd = 0;
    const consumedChanges = /* @__PURE__ */ new Map();
    const expiredWaits = [];
    function expired(which) {
      if (!expiredWaits.includes(which)) expiredWaits.push(which);
    }
    function takeExpiredWaits() {
      const out = expiredWaits.slice();
      expiredWaits.length = 0;
      return out;
    }
    async function settle({ since = null, graceMs = 700, quietMs = 250, timeoutMs = 15e3 } = {}) {
      const started = monotonicNow();
      const baseline = since ?? netCount();
      let sawWork = netCount() > baseline;
      let quietSince = monotonicNow();
      let lastCount = netCount();
      for (; ; ) {
        await new Promise((r) => setTimeout(r, 10));
        const count = netCount();
        if (count !== lastCount) {
          lastCount = count;
          sawWork = sawWork || count > baseline;
          quietSince = monotonicNow();
        }
        const elapsed = monotonicNow() - started;
        if (sawWork && monotonicNow() - quietSince >= quietMs) return awaitRenderFlushes(timeoutMs - elapsed);
        if (!sawWork && elapsed >= graceMs) return awaitRenderFlushes(timeoutMs - elapsed);
        if (elapsed > timeoutMs) {
          expired("settle (the network never went quiet)");
          return;
        }
      }
    }
    async function awaitRenderFlushes(budgetMs) {
      const deadline = monotonicNow() + Math.max(0, Math.min(budgetMs ?? 2e3, 2e3));
      for (; ; ) {
        let pending = 0;
        try {
          pending = host.state?.renderPending?.() ?? 0;
        } catch {
          return;
        }
        if (pending === 0) return;
        if (monotonicNow() >= deadline) {
          expired("the render flush");
          return;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    function netCount() {
      return (host.counter?.started ?? 0) + (host.counter?.inFlight ?? 0);
    }
    async function settleControlMounts({ timeoutMs = 5e3 } = {}) {
      const started = monotonicNow();
      for (; ; ) {
        const readings = host.state?.controlProbes?.() ?? [];
        if (!readings.some((r) => r.state === "mounting")) return;
        if (monotonicNow() - started > timeoutMs) {
          expired("the control-mount wait (a control never left `mounting`)");
          return;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    async function settleNavigations({ timeoutMs = 15e3 } = {}) {
      const started = monotonicNow();
      while (navsInFlight() > 0 && monotonicNow() - started < timeoutMs) {
        await new Promise((r) => setTimeout(r, 10));
      }
      if (navsInFlight() > 0) expired("the navigation wait (a route was still resolving)");
    }
    function navsInFlight() {
      try {
        return host.state?.navsInFlight?.() ?? 0;
      } catch {
        return 0;
      }
    }
    function actionsParkedOnADialog() {
      try {
        return host.state?.dialogAwaits?.() ?? 0;
      } catch {
        return 0;
      }
    }
    async function settleActions({ since = null, pickupMs = 1500, timeoutMs = 3e4, actionsBefore = null } = {}) {
      const started = monotonicNow();
      let peak = 0;
      const startedBefore = actionsBefore;
      while (actionsInFlight() === 0 && monotonicNow() - started < pickupMs) {
        await new Promise((r) => setTimeout(r, 10));
      }
      while (actionsInFlight() > 0 && monotonicNow() - started < timeoutMs) {
        peak = Math.max(peak, actionsInFlight());
        if (actionsParkedOnADialog() > 0) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      await settle({ since, graceMs: 300, quietMs: 250, timeoutMs: Math.max(1e3, timeoutMs - (monotonicNow() - started)) });
      await settleNavigations({ timeoutMs: Math.max(1e3, timeoutMs - (monotonicNow() - started)) });
      releaseStickyTicketIfTheAppDroppedIt();
      const startedAfter = actionsStarted();
      if (startedBefore !== null && startedAfter !== null) return Math.max(peak, startedAfter - startedBefore);
      return peak;
    }
    function releaseStickyTicketIfTheAppDroppedIt() {
      if (host.ticket() && host.ready && !host.currentToken()) host.setTicket(null);
    }
    function actionsInFlight() {
      try {
        return host.state?.inFlightActions?.() ?? 0;
      } catch {
        return 0;
      }
    }
    function actionsStarted() {
      try {
        const reader = host.state?.actionsStarted;
        if (typeof reader !== "function") return null;
        const n = reader();
        return typeof n === "number" ? n : null;
      } catch {
        return null;
      }
    }
    async function step(to, direction) {
      const before = netCount();
      const softAvailable = direction === "back" ? softDepth : softFwd;
      if (softAvailable > 0) {
        if (direction === "back") {
          softDepth--;
          softFwd++;
          host.window.history.back();
        } else {
          softFwd--;
          softDepth++;
          host.window.history.forward();
        }
        await settle({ since: before });
        current = { path: currentPath(), boot: host.bootSeq() };
        return false;
      }
      await hardNavigate(to.path);
      softFwd = 0;
      current = { path: currentPath(), boot: host.bootSeq() };
      return true;
    }
    function recordNavigation() {
      if (!host.ready || current === null) return;
      const now = currentPath();
      if (now === current.path) return;
      const hard = host.bootSeq() !== current.boot;
      histBack.push(current);
      histFwd.length = 0;
      current = { path: now, boot: host.bootSeq() };
      if (hard) {
        softDepth = 0;
        softFwd = 0;
      } else {
        softDepth++;
        softFwd = 0;
      }
    }
    async function pressInPicker(el) {
      const before = netCount();
      clickableFor(el).click();
      await settleActions({ since: before, pickupMs: 120 });
    }
    async function stepToMonth(scope, iso, label) {
      const want = { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) };
      let why = `stepping ran out after 500 presses without reaching it, so ${iso} is further away than this control can be walked`;
      for (let guard = 0; guard < 500; guard++) {
        const shown2 = datesOn(scope);
        if (shown2.length === 0) {
          why = "there was nothing to walk \u2014 the control drew no month grid, so what it rendered is the thing to look at rather than the date";
          break;
        }
        if (shown2.includes(iso)) return;
        const anchor = shown2[6] ?? shown2[0];
        const have = { y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) };
        const months = (want.y - have.y) * 12 + (want.m - have.m);
        if (months === 0) {
          why = `the walk ARRIVED \u2014 that grid is the month ${iso} is in \u2014 and the day itself is not offered, so it is bounded out (a min/max) or disabled rather than out of reach`;
          break;
        }
        const useYear = Math.abs(months) >= 12;
        const back = months < 0;
        const wanted = useYear ? back ? "Previous year" : "Next year" : back ? "Previous month" : "Next month";
        const step2 = scope.querySelector(`[aria-label="${wanted}"]`);
        if (!step2) {
          why = `its month header offers no '${wanted}' control to press (the \`\xAB\`/\`\u2039\`/\`\u203A\`/\`\xBB\` buttons are what a walk uses), so no number of presses could get there from here`;
          break;
        }
        await pressInPicker(step2);
      }
      const shown = datesOn(scope);
      throw new Error(
        `'${label}' could not be walked to ${iso}. Its calendar is showing ${shown.length ? `${shown[0]} \u2026 ${shown[shown.length - 1]}` : "no days at all"}, and ${why}.`
      );
    }
    async function fillPicker({ trigger, label, value }) {
      if (trigger.getAttribute("aria-expanded") === "false") await pressInPicker(trigger);
      try {
        await pickInOpenPicker({ trigger, label, value });
      } finally {
        if (trigger.getAttribute("aria-expanded") === "true") await pressInPicker(trigger);
      }
    }
    async function pickInOpenPicker({ trigger, label, value }) {
      const wanted = parsePickerValue(value);
      const scope = comboScopeOf(trigger);
      const kind = comboKindOf(scope);
      if (kind === "dropdown") {
        throw new Error(
          `'${label}' is a DROPDOWN, not a field you type into \u2014 it offers a list of options, so choose one by its identity: \`Ui.Select("${label}", <the value>)\`.`
        );
      }
      if (kind === "unknown") {
        throw new Error(
          `'${label}' is a combobox, but nothing it opened is a calendar, a time column or a list of options, so there is no way to know what filling it would mean. If it is a custom control, drive it with \`Ui.Click\` on the thing a person would press.`
        );
      }
      const takes = { date: "`2026-04-20`", time: "`09:30`", datetime: "`2026-04-20 09:30`" }[kind];
      if (wanted === null) {
        throw new Error(
          `'${value}' is not a value '${label}' can hold. It is a ${kind === "datetime" ? "date-and-time" : kind} picker, so it takes ${takes} \u2014 ISO, because what the control DRAWS is a formatting choice and this is not.`
        );
      }
      if (wanted.iso !== null && kind === "time") {
        throw new Error(`'${label}' is a TIME picker \u2014 it holds no date. It takes ${takes}.`);
      }
      if (wanted.hour !== null && kind === "date") {
        throw new Error(`'${label}' is a DATE picker \u2014 it holds no time of day. It takes ${takes}.`);
      }
      if (kind === "datetime" && (wanted.iso === null || wanted.hour === null)) {
        const dayOnly = wanted.iso !== null && wanted.hour === null;
        throw new Error(
          `'${label}' holds a date AND a time, so both halves are needed: it takes ${takes}.` + (dayOnly ? ` \u2691 If '${label}' is meant to be a calendar DAY rather than an instant, declare it \`DateOnly\` and bind it with \`DatePicker\` \u2014 that control holds no time of day, takes \`2026-04-20\` on its own, and a \`[Unique]\` over it is one row per DAY.` : "")
        );
      }
      if (wanted.iso !== null) {
        await stepToMonth(scope, wanted.iso, label);
        const cell = scope.querySelector(`[data-osy-item="${wanted.iso}"]`);
        if (!cell) throw new Error(`'${label}' is not showing ${wanted.iso} after walking to its month.`);
        await pressInPicker(cell);
      }
      if (wanted.hour !== null) {
        const toggle = scope.querySelector('[aria-label="Change the time"]');
        if (toggle && toggle.getAttribute("aria-expanded") === "false") await pressInPicker(toggle);
        const pickPart = async (heading, want, what) => {
          const cell = scope.querySelector(`[aria-label="${heading} ${want}"]`);
          if (cell) {
            await pressInPicker(cell);
            return;
          }
          const offered = [...scope.querySelectorAll(`[aria-label^="${heading} "]`)].map((el) => el.getAttribute("aria-label").slice(heading.length + 1));
          throw new Error(
            `'${label}' does not offer ${what} ${want}. ` + (offered.length ? `It offers: ${offered.join(" \xB7 ")}. ` + (heading === "mm" ? "(A `TimePicker` lists minutes in steps \u2014 `minuteStep:` on the control is what decides which.)" : "") : "Its clock is not on screen at all.")
          );
        };
        await pickPart("hh", wanted.hour, "hour");
        await pickPart("mm", wanted.minute, "minute");
      }
    }
    async function follow() {
      const to = host.state.redirectedTo;
      if (!to) return null;
      const target = to.split("?")[0] || "/";
      const restore = host.capturePage();
      try {
        await hardNavigate(target);
      } catch (err) {
        host.restorePage(restore);
        host.warn(`redirect to '${target}' could not be followed: ${err?.message ?? err}`);
      }
      return to;
    }
    const commands = {
      /** M176 — THE BACK BUTTON, and the forward one nobody remembers to build.
       *
       *  ⚑ IT IS REAL HISTORY, NOT A RE-VISIT. Going back to a page the APP navigated to is a `popstate` the ROUTER has
       *  to answer — resolve the previous route and re-render it with no page load — and that is the one code path a
       *  back button exists to exercise. Re-visiting the path would prove the route renders, which every other test
       *  already proves, while leaving the thing that actually breaks untested.
       *
       *  Back across a HARD navigation is a page load instead, exactly as in a browser. One verb either way: a person
       *  pressing Back does not know which kind of navigation brought them here, and neither should the test.
       *
       *  ⚠ NOTHING TO GO BACK TO IS A REFUSAL. Doing nothing would leave the previous screen on display, and the
       *  assertion after it would pass against a page the test never navigated to. */
      async back() {
        if (histBack.length === 0) {
          throw new Error(`there is nothing to go back to \u2014 this is the first screen this test opened. Currently on '${current?.path ?? "(nowhere)"}'.`);
        }
        const to = histBack.pop();
        histFwd.unshift(current);
        const reloaded = await step(to, "back");
        return { path: currentPath(), reloaded };
      },
      async forward() {
        if (histFwd.length === 0) {
          throw new Error(`there is nothing to go forward to \u2014 nothing has gone back from here. Currently on '${current?.path ?? "(nowhere)"}'.`);
        }
        const to = histFwd.shift();
        histBack.push(current);
        const reloaded = await step(to, "forward");
        return { path: currentPath(), reloaded };
      },
      /** M179 — PIN THE CLIENT'S CLOCK to this instant (epoch ms), and re-render whatever reads it.
       *
       *  ⚑ IT IS THE SAME `Clock.Set` A TEST ALREADY WRITES. The engine has had a test clock since the effect-stub slice;
       *  this is the other half of it, because a countdown lives in the BROWSER and the engine's clock never reached it.
       *  One verb, one notion of what time it is — a test that pinned the server to Tuesday and left the page on the real
       *  Friday would be a world nobody can reason about.
       *
       *  The page is settled afterwards: a clock jump can make a `live` view refetch or an action fire, and a caller must
       *  not have to know which. */
      async clock({ atMs }) {
        host.setPinnedNow(Number(atMs));
        if (!host.ready) return { value: host.pinnedNow() };
        const before = netCount();
        host.setNow(host.pinnedNow());
        await settle({ since: before });
        return { value: host.pinnedNow() };
      },
      async visit({ path }) {
        dom.forgetInteractions();
        const from = current;
        await hardNavigate(path);
        const redirectedTo = await follow();
        if (from) histBack.push(from);
        histFwd.length = 0;
        current = { path: currentPath(), boot: host.bootSeq() };
        return { path: currentPath(), redirectedTo };
      },
      // ⚑ THESE THREE IGNORE AN OPEN MODAL AND OBEY AN EXPLICIT `within:`. Two different narrowings, and conflating them
      // was a real bug — see `textRoot`.
      //
      // An interaction has to be reachable: pressing a control behind a scrim is something no user can do, so resolving
      // one there is simply a wrong answer. Reading is different — `text` is the DIAGNOSTIC dump that failure messages
      // are built from, and narrowing it would hide the page whenever a dialog is open, exactly when you most need to
      // see both. `has` follows it so that `Assert.Visible` keeps meaning "somewhere on screen", which is what it says.
      //
      // That leaves "is a dialog open, and WHICH" unanswerable by `Assert.Visible` alone — deliberately. It is a
      // different question and it gets its own verb rather than a redefinition of this one.
      async has({ text }) {
        return { value: readableTexts().some((t) => t.includes(text)) };
      },
      async text() {
        return { value: readableTexts() };
      },
      /** `Assert.TextIs` — does some element read EXACTLY this?
       *
       *  ⚑ WHY EXACTNESS NEEDED ITS OWN COMMAND rather than a comparison over `text`. The two answers a caller needs on
       *  failure are "nothing reads that" and "those words ARE on screen, but as several separate elements" — and the
       *  second is the whole reason this exists. The desk summary rendered `0` and `breached` as two adjacent `Text`
       *  nodes: `Assert.Visible("0 breached")` matched NOTHING while both words were plainly on screen, and the stray
       *  `breached` then broke an unrelated `Assert.Hidden("breached")`. CONTAINS cannot tell those two apart, and
       *  neither can a caller holding only a list of strings.
       *
       *  Whitespace is COLLAPSED on both sides, not merely trimmed: a rendered `"Hello   world"` and an expected
       *  `"Hello world"` are the same sentence to the person reading the page, and the difference is a layout artifact
       *  no test should be asserting. */
      async textis({ text }) {
        const want = collapse(text);
        const texts = readableTexts();
        const exact = texts.some((t) => collapse(t) === want);
        const split = !exact && !texts.some((t) => collapse(t).includes(want)) && collapse(texts.join(" ")).includes(want);
        return { value: exact, split, texts: texts.slice(0, 20) };
      },
      /** The MODAL in front of the user, or null. `component` is what the platform opened; `name` is the ACCESSIBLE NAME
       *  of the panel inside it — the title a person reads.
       *
       *  ⚑ `name: null` means "a dialog IS open and names itself to nobody", which is deliberately NOT the same answer as
       *  `null` (no dialog at all). The caller refuses the first and fails the second, because the fixes are opposite: one
       *  is a missing `role: Dialog`/`label:` on the app's panel, the other is a dialog that never opened. */
      /** M173 — WAIT FOR THE SERVER'S OWN CHANGE SIGNAL, then for the refetch it triggers.
       *
       *  ⚑ IT WAITS, IT DOES NOT SEND. The previous version of this command INJECTED a frame, because the harness had no
       *  socket; a test written on it kept passing whether or not the server emitted anything. Now the socket is real
       *  (`headless.mjs`), so the only honest thing to do is watch for the frame the server pushed on commit.
       *
       *  ⚑ AND IT IS STILL EXPLICIT, for the reason it always was: a signal arrives on the server's schedule, so a test
       *  that just asserted after a write would race it. One sentence — "wait for the live update" — says the
       *  back-and-forth out loud instead of hiding it in an invisible wait.
       *
       *  Each call CONSUMES one frame for that type, so two waits mean two updates rather than one update counted twice.
       *  A frame that arrived before the call still counts: the write happens first, and the signal chases it. */
      async awaitchange({ entityType, timeoutMs }) {
        const bound = timeoutMs ?? 5e3;
        const before = netCount();
        const seen = () => host.live.changes().filter((c) => c.entityType === entityType).length;
        const already = consumedChanges.get(entityType) ?? 0;
        const until = monotonicNow() + bound;
        while (seen() <= already && monotonicNow() < until) await new Promise((r) => setTimeout(r, 10));
        if (seen() <= already) {
          const subs = host.live.subscriptions().map((m) => m.entityType ?? m.scope ?? JSON.stringify(m));
          const socket = host.live.state();
          const subscribed = subs.some((t) => t === entityType);
          const cause = socket === "open" && subscribed ? `The socket is open and this page IS subscribed to '${entityType}', so neither of the usual causes applies: the server emitted nothing for this commit \u2014 the action you pressed committed no change. Check that the action reaches a \`UnitOfWork.Commit()\` on the path you took.` : socket !== "open" ? `The socket is ${socket}, so no signal could arrive: only an app-scoped (signed-in) session opens one. Sign in first, or assert on the data rather than on a live update.` : `This page is not subscribed to '${entityType}' \u2014 a query only subscribes when it is declared \`live\`.`;
          throw new Error(
            `no change signal for '${entityType}' arrived within ${bound}ms. Socket: ${socket}. Subscribed to: ${subs.join(", ") || "(nothing)"}. Signals seen: ${host.live.changes().map((c) => c.entityType).join(", ") || "(none)"}. ` + cause
          );
        }
        consumedChanges.set(entityType, already + 1);
        await settle({ since: before });
        return { value: entityType };
      },
      /** What the client SUBSCRIBED to — read off the REAL wire, so a test can prove a live query asked the server for
       *  its type at all. That is the half that silently does nothing when a query is not actually `live`. */
      async subscriptions() {
        return { value: host.live.subscriptions().map((m) => JSON.stringify(m)) };
      },
      /** Is this checkbox/toggle ON? `null` when it does not SAY — never `false`, which would be a guess that passes. */
      async ischecked({ label }) {
        const box = candidates().find((el) => el.tagName === "INPUT" && el.getAttribute("type") === "checkbox" && ((el.getAttribute("name") ?? "").includes(label) || (el.getAttribute("aria-label") ?? "").includes(label)));
        const target = box ?? findByAriaLabel(label) ?? byText(label);
        if (!target) {
          throw new Error(`no checkbox or toggle matching '${label}'. What is currently reachable: ${reachableTexts().slice(0, 20).join(" \xB7 ") || "(nothing)"}${scopeNote()}${vanishedNote(label)}${vanishedEarlierNote(label)}`);
        }
        if (target.tagName === "INPUT") return { value: !!target.checked };
        const aria = target.getAttribute("aria-checked") ?? target.closest?.("[aria-checked]")?.getAttribute("aria-checked");
        return { value: aria === null || aria === void 0 ? null : aria === "true" };
      },
      /** Is this disclosure control OPEN? Null when it does not say.
       *
       *  ⚑ THE ACCESSIBLE NAME LEADS, for the reason `select` had to learn: a field's visible caption and the control it
       *  names answer to the same words, and text-first resolves to the caption — a plain element with no state at all,
       *  which reads as "does not say" about a control that says it perfectly well.
       *
       *  Climbs to the nearest ancestor carrying the state, exactly as `ischecked` does: the name may sit on the trigger
       *  while the state sits on the same element or a wrapper, and a test should not have to know which. */
      async isexpanded({ label }) {
        const named = candidates().filter((el) => el.getAttribute("aria-label") === label);
        const pool = named.length > 0 ? named : [byText(label)].filter(Boolean);
        if (pool.length === 0) {
          throw new Error(`no control matching '${label}'. What is currently reachable: ${reachableTexts().slice(0, 20).join(" \xB7 ") || "(nothing)"}${scopeNote()}${vanishedNote(label)}${vanishedEarlierNote(label)}`);
        }
        const stateful = disjointDeepest(pool.filter((el) => el.getAttribute("aria-expanded") !== null || el.closest?.("[aria-expanded]")));
        if (stateful.length > 1) {
          throw new Error(
            `'${label}' names ${stateful.length} different controls that each report an expanded state, so which was meant is ambiguous:
${describeCandidates(stateful)}
Narrow it with \`Ui.Within(<container or row>) { \u2026 }\`, or give them distinct labels.`
          );
        }
        const target = stateful[0];
        if (!target) return { value: null };
        const aria = target.getAttribute("aria-expanded") ?? target.closest?.("[aria-expanded]")?.getAttribute("aria-expanded");
        return { value: aria === null || aria === void 0 ? null : aria === "true" };
      },
      /** Does the option with this ROW IDENTITY say it is the chosen one? Null when nothing on screen carries the
       *  identity, or when what does declares no selected state — two different answers a caller reports differently.
       *
       *  By identity and never by text, for the same reason `select` matches that way: a generic control's options are
       *  drawn by its caller's template. */
      async isselected({ item }) {
        const options = candidates().filter((el) => el.getAttribute("data-osy-item") === String(item));
        if (options.length === 0) return { value: null };
        for (const el of options) {
          const holder = el.getAttribute("aria-selected") !== null ? el : el.closest?.("[aria-selected]") ?? el.querySelector?.("[aria-selected]");
          const aria = holder?.getAttribute("aria-selected");
          if (aria !== null && aria !== void 0) return { value: aria === "true" };
        }
        return { value: null };
      },
      /** M199 — ASK A FOREIGN CONTROL ABOUT ITSELF: one field of the `probe { }` block its author declared.
       *
       *  ⚑ THIS IS NOT A DOM QUESTION, and that is the entire reason the verb exists. Every other read here asks the
       *  SCREEN, which works because an app's own UI is atoms the platform rendered. A foreign control's insides are not:
       *  it may paint into a canvas, a contenteditable, or a shadow tree, and under a headless DOM it may lay nothing out
       *  at all — so `is the document dirty` and `how many matches did the search find` are simply not on screen to be
       *  read. This asks the control, through the reader `boot({ onControlProbes })` handed over.
       *
       *  The control is named by its DECLARED name (`MarkdownEditor`) — what the app wrote at the call site, and the only
       *  name a control has: a mount element carries no accessible name of its own. Two instances of one control on a
       *  page are told apart by `within:`, by which element each mounted into.
       *
       *  Three outcomes, reported separately because they have three different fixes: the control is not here, it
       *  implements no `probe()` at all, or it answered without the field asked for. */
      async probe({ control, field }) {
        await settleControlMounts();
        const readings = host.state.controlProbes();
        const root = scopeRoot();
        const inScope = dom.getWithinScope() === null ? readings : readings.filter((r) => root.contains(r.element));
        const mine = inScope.filter((r) => r.control === control);
        if (mine.length === 0) {
          const here = [...new Set(inScope.map((r) => r.control))].sort();
          throw new Error(
            `no control named '${control}' is mounted` + (dom.getWithinScope() === null ? " on this page" : ` within ${dom.getWithinScope().map((x) => `'${x}'`).join(" \u25B8 ")}`) + ". " + (here.length === 0 ? "No foreign control is mounted here at all \u2014 a `probe` reads a `control` block's declaration, not an ordinary component. Check the page renders it, and that it mounted (a control that failed to load reports its own error)." : `Mounted here: ${here.join(", ")}.`)
          );
        }
        if (mine.length > 1) {
          throw new Error(
            `'${control}' is mounted ${mine.length} times on this screen, so which was meant is ambiguous. Narrow it with \`within:\` \u2014 a container or a row that holds the one you mean.`
          );
        }
        const { reported, state, error } = mine[0];
        if (state !== "mounted") return { value: { outcome: "not-running", state, error: error ?? null, fields: [] } };
        if (reported === null) return { value: { outcome: "no-probe", fields: [] } };
        const keys = Object.keys(reported).sort();
        if (!(field in reported)) return { value: { outcome: "no-field", fields: keys } };
        return { value: { outcome: "read", fields: keys, ...canonicalProbeValue(reported[field]) } };
      },
      /** Which way does this container lay its children out — 'across' or 'down'? Null when it says nothing.
       *
       *  ⚑ THE DIRECTION, NEVER THE ATOM. A `Row` flows across and a `Stack` flows down, and so does anything else
       *  styled that way — so this answers what a PERSON sees rather than which primitive the author reached for. A test
       *  that asserted `Row` by name would go red on a refactor that changed nothing visible.
       *
       *  ⚠ DECLARED, not measured. happy-dom has no layout engine (see `installLayoutModel` in headless.mjs), so "are
       *  these boxes actually beside each other" is unanswerable here. What IS answerable — and what a responsive test is
       *  really asking — is which way the app said to flow them. The class the walker stamps on every atom
       *  (`osy-row` / `osy-stack`) is that statement, and an inline `flex-direction` overrides it, because an app that
       *  styled its way to the other direction means the other direction.
       */
      async flow({ container }) {
        const found = findByAriaLabel(container, { exact: true }) ?? byText(container);
        if (!found) {
          throw new Error(`no container matching '${container}'. What is currently reachable: ${reachableTexts().slice(0, 20).join(" \xB7 ") || "(nothing)"}${scopeNote()}`);
        }
        const inline = found.style?.flexDirection || "";
        if (inline.startsWith("row")) return { value: "across" };
        if (inline.startsWith("column")) return { value: "down" };
        const cls = found.getAttribute("class") ?? "";
        if (/\bosy-row\b/.test(cls)) return { value: "across" };
        if (/\bosy-stack\b/.test(cls)) return { value: "down" };
        return { value: null };
      },
      /** The ACCESSIBLE NAME of whatever has keyboard focus, or null when nothing does.
       *
       *  ⚑ The name, not the element: a test says "the keyboard is on Email", which is what a person would say, and it
       *  survives the wrapper changes that a structural answer would not. `document.body` is happy-dom's resting value
       *  for "nothing focused" and reads as nothing here, which is the honest answer. */
      async focused() {
        const el = host.document.activeElement;
        if (!el || el === host.document.body) return { value: null };
        const name = el.getAttribute?.("aria-label") ?? el.getAttribute?.("placeholder") ?? el.getAttribute?.("name") ?? (el.textContent ?? "").trim();
        return { value: name.length > 0 ? name : null };
      },
      /** `within:` — set (or clear, with null) the scope PATH every locator is confined to. */
      async scope({ scope, scopes }) {
        dom.setWithinScope(scopes ?? (scope == null ? null : [scope]));
        if (dom.getWithinScope() !== null) scopeRoot();
        return { value: dom.getWithinScope() };
      },
      async dialog() {
        const app = host.document.getElementById("app") ?? host.document.body;
        const hosts = app.querySelectorAll('[data-osy-dialog], [role="dialog"]');
        if (hosts.length === 0) return { value: null };
        const topmost = hosts[hosts.length - 1];
        const panel = topmost.getAttribute("role") === "dialog" ? topmost : topmost.querySelector('[role="dialog"]');
        return {
          value: {
            // `component` is the platform host's stamp when there is one; for an inline dialog the nearest thing to a
            // component name is its title, which is what the app named it and what a reader will recognise.
            component: topmost.getAttribute("data-osy-dialog") ?? (panel?.getAttribute("aria-label") || "Dialog"),
            name: panel === null ? null : panel.getAttribute("aria-label") ?? ""
          }
        };
      },
      async path() {
        return { value: currentPath() };
      },
      /** ⛔ THE PLATFORM'S OWN FAILURE SURFACES, so a test cannot pass over one in silence.
       *
       *  A render or action fault does not take the page down — it raises the `.osy-action-failed` banner and leaves the
       *  rest of the screen working. So a test that asserts on the part that still works PASSES, with a dead subtree and
       *  an error sitting on the page behind it.
       *
       *  ⚑ MEASURED 2026-08-27 on eval run 304, and it is the reason that run could not see what was wrong: its
       *  equal-split test was GREEN for the whole episode while the same page carried a binding that threw on every
       *  render. The run worked it out for itself — *"I'm wondering if the 'cannot use object as a decimal operand'
       *  error also occurred silently in the first equal-split test that already passed, since that test never
       *  explicitly checked for a toast error"* — and it was right. The nine-word message reached the run only because
       *  an unrelated `Assert.Visible` happened to dump the page.
       *
       *  Both surfaces, because both are the platform saying something went wrong and neither fails anything today:
       *  an ACTION/render fault, and a REFUSED QUERY (a region that renders zero rows because the read was denied). */
      async faults() {
        const read = (sel) => [...host.document.querySelectorAll(sel)].map((el) => (el.textContent || "").trim()).filter((t) => t.length > 0);
        const actions = [...host.document.querySelectorAll(".osy-action-failed")].map((box) => {
          const text = (box.querySelector(".osy-action-failed-message")?.textContent || "").trim();
          if (text.length === 0) return "";
          const name = box.getAttribute("data-osy-action") || "";
          if (name === "") return text;
          return name === "render" ? `a render failed: ${text}` : `action '${name}' failed: ${text}`;
        }).filter((t) => t.length > 0);
        return { value: [...actions, ...read(".osy-query-failed-message")] };
      },
      async click({ label }) {
        recordInteraction("Ui.Click", label);
        const found = findByAriaLabel(label, { exact: true, prefer: clickable }) ?? byText(label, { prefer: clickable });
        if (!found) {
          const seen = reachableTexts().slice(0, 20);
          throw new Error(`no element matching '${label}'. What is currently reachable: ${seen.join(" \xB7 ") || "(nothing)"}${scopeNote()}${vanishedNote(label)}${vanishedEarlierNote(label)}`);
        }
        interactionResolved();
        const before = netCount();
        const actionsBefore = actionsStarted();
        const pathBefore = currentPath();
        clickableFor(found).click();
        const peakActions = await settleActions({ since: before, actionsBefore });
        const followed = await follow();
        await host.live.waitBooted?.();
        await host.live.waitPainted?.();
        await host.live.waitLoaded?.();
        if (followed === null && currentPath() !== pathBefore) {
          await settle({ since: before });
          await host.live.waitSubscribed();
          await settleControlMounts();
        }
        return { path: currentPath(), redirectedTo: followed, followed: followed !== null, actions: peakActions };
      },
      async fill({ label, value }) {
        recordInteraction("Ui.Fill", label);
        const target = fieldFor(label);
        if (!target) {
          const combo = comboTriggerFor(label);
          if (combo) {
            interactionResolved();
            return await fillPicker({ trigger: combo, label, value }) ?? { value };
          }
          throw new Error(noFieldRefusal(label));
        }
        interactionResolved();
        target.focus?.();
        target.value = value;
        const before = netCount();
        target.dispatchEvent(new host.window.Event("input", { bubbles: true }));
        await settle({ since: before });
        return { value };
      },
      /** The FIELD FINDER `fill` and `value` share — by placeholder, then by name. One definition, because a test that
       *  can fill a field and cannot read it back would be a difference nobody could explain. */
      /** What the app's BOUND MEMBER holds — not what the box on screen shows, when the two can differ.
       *
       *  ⛔ THIS USED TO BE A TAUTOLOGY. `fill` writes `target.value` and this read `target.value` back, so
       *  `Assert.Value` after a `Ui.Fill` proved the driver typed and never that the binding took it. Eval run 8 of 019
       *  used it as a probe and reasoned from the answer — *"it didn't fail, so the binding works"* — which the
       *  assertion could not have told it either way.
       *
       *  `data-osy-bound` is stamped by the reconciler with the member's value (see `reconcile.ts`), so a disagreement
       *  between it and `el.value` IS the defect: the keystroke reached the DOM and not the app. Falls back to the DOM
       *  value where there is no binding to speak of — a plain `Input` with no member behind it — which is the only
       *  case where the two cannot differ. */
      async value({ label }) {
        const target = fieldFor(label);
        if (target === null) return { value: null };
        const bound = target.getAttribute?.("data-osy-bound");
        return { value: bound ?? target.value ?? "" };
      },
      /** Tick or untick. Idempotent BY CONSTRUCTION — it sets the state asked for and clicks only if that is a change —
       *  because a driver that toggled would make the same test pass or fail on whatever was there before it ran.
       *
       *  It CLICKS rather than setting `.checked`: the platform's Checkbox is a Pressable whose label is part of the hit
       *  target (`Checkbox(notify, "Email me", ToggleNotify)`), and the state it reflects is very often NOT a plain bool
       *  field — so the app's own handler is what has to run. Poking the DOM property would move the box and leave the
       *  page's state untouched, which is the silent half-success this whole surface exists to avoid. */
      async check({ label, on }) {
        recordInteraction("Ui.Check", label);
        const want = on !== false;
        const box = candidates().find((el) => el.tagName === "INPUT" && el.getAttribute("type") === "checkbox" && ((el.getAttribute("name") ?? "").includes(label) || (el.getAttribute("aria-label") ?? "").includes(label)));
        const target = box ?? findByAriaLabel(label, { exact: true }) ?? byText(label);
        if (!target) {
          const seen = reachableTexts().slice(0, 20);
          throw new Error(`no checkbox or toggle matching '${label}'. What is currently reachable: ${seen.join(" \xB7 ") || "(nothing)"}${scopeNote()}${vanishedNote(label)}${vanishedEarlierNote(label)}`);
        }
        interactionResolved();
        const readState = () => {
          if (target.tagName === "INPUT") return !!target.checked;
          const aria = target.getAttribute("aria-checked") ?? target.closest?.("[aria-checked]")?.getAttribute("aria-checked");
          return aria === null || aria === void 0 ? null : aria === "true";
        };
        const state = readState();
        if (state === null) {
          throw new Error(
            `'${label}' does not say whether it is checked, so this cannot be done idempotently \u2014 clicking blind would TICK an already-unticked box as readily as untick it. The control needs role="checkbox" + aria-checked (which is also what makes it announce itself to a screen reader). The platform's own Checkbox does not carry them yet \u2014 see ledger M157.`
          );
        }
        if (state === want) return { value: want, changed: false };
        const before = netCount();
        clickableFor(target).click();
        await settleActions({ since: before });
        await follow();
        return { value: want, changed: true };
      },
      /** M162 — render at this width, from now on.
       *
       *  ⚑ ONE VERB, TWO USES, because they are the same act. Called before a `visit` it CHOOSES the layout a test runs
       *  at; called after one it RESIZES, which is itself a thing worth testing — a responsive component has to re-flow
       *  when the window changes, and an observer that never fires is a real bug that only a resize can catch.
       *
       *  Before this, no width existed at all: happy-dom has no layout engine, every `clientWidth` was 0, and the client
       *  therefore rendered the NARROW arm of every responsive component — so a test meaning to assert the desktop table
       *  asserted the mobile cards instead, and PASSED. */
      async viewport({ width, height }) {
        const w = Number(width);
        if (!Number.isFinite(w) || w <= 0) throw new Error(`viewport width must be a positive number, got '${width}'`);
        let h = null;
        if (height != null) {
          h = Number(height);
          if (!Number.isFinite(h) || h <= 0) throw new Error(`viewport height must be a positive number, got '${height}'`);
        }
        const before = host.ready ? netCount() : 0;
        host.setViewport(w, h);
        if (host.ready) await settle({ since: before });
        return { value: w };
      },
      /** Every rendered row's IDENTITY, in DOCUMENT ORDER — which is the order a person reads them in.
       *
       *  ⚑ Identities, not text: the same reason `select` matches on them. A row's rendered text is a presentation
       *  choice a template can change without changing what the row IS, and two rows can read alike. `querySelectorAll`
       *  already answers in document order, which IS the visual order for a grid or a list.
       *
       *  Duplicates are KEPT rather than collapsed: the same row shown in two lists has no single position, and the
       *  caller refuses that rather than silently comparing whichever rendered first. Collapsing here would hide it. */
      async roworder() {
        const seen = [];
        let last = null;
        for (const el of candidates()) {
          const id = el.getAttribute("data-osy-item");
          if (id === null) continue;
          if (id !== last) seen.push({ id, name: rowName(el) });
          last = id;
        }
        return { value: seen };
      },
      /** How many ITEMS the list this label names is showing.
       *
       *  ⚑ IT COUNTS THE PLATFORM'S OWN STAMP (M160), not a shape guessed at from the markup. Every row a `foreach`
       *  rendered carries `data-osy-item`, so this counts what the page is ACTUALLY repeating — which survives a
       *  restyle, a wrapper element, and a change of atom, none of which a CSS-shaped count would.
       *
       *  ⚠ ZERO AND ABSENT ARE DIFFERENT ANSWERS. A list that is present and empty counts 0 — asserting that is how a
       *  test proves a filter excluded everything. No such container is `null`, and the caller words that failure. */
      async items({ container }) {
        const found = container ? findByAriaLabel(container) ?? byText(container) : null;
        if (!found) return { value: null };
        const seen = /* @__PURE__ */ new Set();
        for (const el of found.querySelectorAll("[data-osy-item]")) seen.add(el.getAttribute("data-osy-item"));
        return { value: seen.size };
      },
      /** M175 — ONE CELL of a table: the ROW by its identity, the COLUMN by its header, the cell by POSITION.
       *
       *  ⚑ THE SAME DECLARATION A SCREEN READER NEEDS, and that is the design rather than a happy coincidence:
       *  `role="row"` / `role="columnheader"` / `role="gridcell"` are what let a person navigate a table cell by cell
       *  with each value announced under its column, and they are exactly what makes a cell addressable here. A grid this
       *  cannot read is a grid that is broken for both, so REFUSING is the right answer — and each way of being missing
       *  gets its own outcome, because they have four different fixes.
       *
       *  ⚠ It never matches a cell by its TEXT. The text is what the assertion is checking, so finding the cell by it
       *  would be circular: every assertion would pass or report "not found", and never "reads the wrong thing". */
      async cell({ row, column }) {
        const root = scopeRoot();
        const rows = disjointDeepest(rowsNamed(root, row));
        const onScreen = [...new Set(renderedRows(root).map((r) => r.name || r.id))];
        if (rows.length === 0) return { value: { outcome: "NoSuchRow", columns: [], rows: onScreen, cellsInRow: 0 } };
        if (rows.length > 1) {
          throw new Error(`'${row}' names ${rows.length} rows on this screen, so which cell was meant is ambiguous. Two rows reading alike have no single answer \u2014 narrow with \`within:\`, or name the row itself.`);
        }
        const grid = rows[0].closest('[role="grid"]') ?? rows[0].closest('[role="table"]') ?? root;
        const columns = [...grid.querySelectorAll('[role="columnheader"]')].map(accessibleName);
        if (columns.length === 0) {
          return { value: { outcome: "NoColumnHeaders", columns: [], rows: onScreen, cellsInRow: 0 } };
        }
        const index = columns.indexOf(column);
        if (index < 0) return { value: { outcome: "NoSuchColumn", columns, rows: onScreen, cellsInRow: 0 } };
        const cells = [...rows[0].querySelectorAll('[role="gridcell"], [role="cell"]')];
        if (cells.length === 0) {
          return { value: { outcome: "RowDeclaresNoCells", columns, rows: onScreen, cellsInRow: 0 } };
        }
        if (index >= cells.length) {
          return { value: { outcome: "RowIsShort", columns, rows: onScreen, cellsInRow: cells.length } };
        }
        return {
          value: {
            outcome: "Found",
            text: dom.renderedTextsIn(cells[index]).join(" ").trim(),
            columns,
            rows: onScreen,
            cellsInRow: cells.length
          }
        };
      },
      /** M180 — WHAT THE FORM IS REFUSING, and it is the model's own list rather than a scrape of the page.
       *
       *  ⚑ THE ASSOCIATION IS ALREADY THERE. Each violation carries the ENTITY and FIELD it is about, so "which field is
       *  this message under" needs no DOM link — which is why this surface is not blocked on element identity (M159) the
       *  way `aria-describedby` is.
       *
       *  ⚠ It is the REVEALED set: what the person has actually been shown (they left the field, or tried to save). A
       *  test that read the stricter internal list would accuse a blank field nobody has filled in yet, which is exactly
       *  the thing the reveal rule exists to stop the app doing. */
      async violations() {
        return { value: host.state.violations().map((v) => ({ entity: v.Entity, field: v.Field, rule: v.Rule, message: v.Message })) };
      },
      /** M177 — CHOOSE A FILE. The one interaction a driver cannot perform for real: no code can open a file picker, and
       *  no test should want it to.
       *
       *  ⚑ EVERYTHING AFTER THE PICK IS REAL. The chosen file is put on the control's own `<input type="file">` and a
       *  `change` is dispatched — the same event the picker fires — so the client reads it, POSTs the bytes to the
       *  app-file store over the session, and runs the app's `onUploaded` action with the stored file. The simulated part
       *  is the dialog; the part that breaks is the chain, and the chain is exercised end to end.
       *
       *  ⚠ THE FILE IS BUILT WITH NODE'S `File`, not happy-dom's. `FormData` and `fetch` here are node's, and a foreign
       *  Blob implementation is not something undici will serialise — the upload would fail inside the client with an
       *  error that reads like the app rejecting the file. */
      async upload({ label, name, content }) {
        const target = findByAriaLabel(label) ?? byText(label);
        if (!target) {
          throw new Error(
            `no upload control matching '${label}'. What is currently reachable: ${reachableTexts().slice(0, 20).join(" \xB7 ") || "(nothing)"}${scopeNote()}${vanishedNote(label)}${vanishedEarlierNote(label)}`
          );
        }
        const input = target.querySelector?.('input[type="file"]') ?? target.closest?.("label")?.querySelector?.('input[type="file"]');
        if (!input) {
          throw new Error(`'${label}' is on the screen but is not an upload control \u2014 it has no file input. An \`Upload(...)\` renders one; a Button or a Link does not.`);
        }
        const file = new File([content], name, { type: mimeFor(name) });
        Object.defineProperty(input, "files", { value: [file], configurable: true });
        const before = netCount();
        input.dispatchEvent(new host.window.Event("change", { bubbles: true }));
        await settleActions({ since: before });
        return { value: name };
      },
      /** Choose an option by its IDENTITY, not by what it renders.
       *
       *  ⚑ THE OPTIONS ARE DRAWN BY THE CALLER'S TEMPLATE. The generic `Dropdown<T>` renders whatever it is given — an
       *  avatar and two lines, possibly no text at all — so matching on rendered text would be wrong the day two rows
       *  read alike, and would couple every test to a presentation choice a template can change without changing what
       *  the field means. The platform stamps each row's identity as it renders it (`data-osy-item`, M160), and the
       *  engine derives the SAME string from the test's operand, so the two agree by construction.
       *
       *  It OPENS the control first, because that is what a person does and because a closed dropdown has no options in
       *  the DOM at all — its panel is behind an `if (open)`. */
      async select({ label, item, enumType }) {
        recordInteraction("Ui.Select", label);
        const trigger = label ? clickableFor(findByAriaLabel(label, { exact: true }) ?? byText(label) ?? {}) : null;
        if (trigger?.getAttribute?.("aria-expanded") === "false") {
          const before2 = netCount();
          trigger.click();
          await settleActions({ since: before2 });
        }
        interactionResolved();
        const controlScope = (() => {
          if (!trigger?.parentElement) return null;
          for (let p = trigger.parentElement; p; p = p.parentElement) {
            if (p.querySelector?.('[role="listbox"]')) return p;
            if (p.querySelector?.("[data-osy-item]")) return p;
          }
          return null;
        })();
        const inScope = (el) => controlScope === null || controlScope.contains(el);
        const pickerKind = controlScope === null ? "dropdown" : comboKindOf(controlScope);
        if (pickerKind === "date" || pickerKind === "time" || pickerKind === "datetime") {
          if (trigger?.getAttribute?.("aria-expanded") === "true") await pressInPicker(trigger);
          const takes = { date: "2026-04-20", time: "09:30", datetime: "2026-04-20 09:30" }[pickerKind];
          throw new Error(
            `'${label}' is a ${pickerKind === "datetime" ? "date-and-time" : pickerKind} picker. It holds a VALUE rather than one of a list of options, so it is filled, not selected: \`Ui.Fill("${label}", "${takes}")\` \u2014 which also walks the calendar to the right month, as a person would.`
          );
        }
        const options = candidates().filter((el) => inScope(el) && el.getAttribute("data-osy-item") === String(item));
        if (options.length === 0) {
          const offered = [...new Set(candidates().filter(inScope).map((el) => el.getAttribute("data-osy-item")).filter((v) => v !== null))];
          throw new Error(noOptionRefusal(label, item, offered, enumType));
        }
        const targets = [...new Set(disjointDeepest(options).map(clickableFor))];
        if (targets.length > 1) {
          const ordinal = /^\d+$/.test(String(item)) ? ` ('${item}' is an enum member's POSITION \u2014 what the member you passed is stamped as on screen)` : "";
          throw new Error(
            `the identity '${item}'${ordinal} is offered by ${targets.length} different controls, so which was meant is ambiguous:
${describeCandidates(targets)}
Narrow it with \`within:\`, naming the control or the row that holds the one you mean.`
          );
        }
        const target = targets[0];
        const before = netCount();
        clickableFor(target).click();
        await settleActions({ since: before });
        await follow();
        return { value: String(item) };
      },
      /** Can this control be used, and if not, what does it say?
       *
       *  ⚑ THE AUTHORITY HALF OF THE UI, and the only way to check it end to end. `canPress:` reflects a declared policy
       *  onto a control (`disabled` when the policy does not hold) and `whenDenied:` carries the app's own sentence as a
       *  `title`. Until this verb the whole surface was untestable — and it is where a silent wrong answer costs most,
       *  because a control that SHOULD be refused and is not looks identical on screen to one that is.
       *
       *  ⚠ IT REFUSES A MATCH THAT IS NOT A CONTROL, rather than reporting "enabled". `byText` finds the deepest element
       *  containing the words, which on many pages is a `div` — and a `div` has no `disabled`, so reading one answers
       *  "operable" for something that is not a control at all. That is the silent pass this whole surface exists to
       *  avoid, and it is the same refusal `check` makes against a box with no reportable state. */
      async control({ label }) {
        const found = findByAriaLabel(label, { exact: true }) ?? byText(label, { prefer: (el2) => clickTargetOf(el2) !== null });
        if (!found) return { value: null };
        const el = clickableFor(found);
        const interactive = el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
        if (!interactive) {
          throw new Error(
            `'${label}' matches a <${el.tagName.toLowerCase()}>, which is not a control \u2014 it has no operable state to report, so answering "enabled" would be a guess. If this IS meant to be a control, render it as a Pressable/Button/Link (the platform maps those to real elements); if the words merely appear near one, name the control itself.`
          );
        }
        const reason = el.getAttribute("title");
        return { value: { enabled: !el.disabled, reason: reason === null ? null : reason } };
      },
      /** Press a NAMED key on whatever has focus (the document when nothing does). Named, never coded: a test says what
       *  a person pressed, and the client's own keyboard vocabulary (M128) already speaks these names.
       *
       *  ⛔ AND IT CARRIES `.code` AS WELL AS `.key`, because a real keypress does and half the listeners read it.
       *  The event used to be built with `key` alone, so `.code` was `''` — and TWO consumers read it: a `keys:`
       *  surface (`walker.ts`, `keySurface.byCode.get(ke.code)`) and the splitter's arrow handling. So anything bound
       *  through `keys:` was UNDRIVABLE from a test: `Ui.Press` dispatched, nothing matched, nothing happened, and the
       *  test read as a page that ignored the key. A verb that silently does nothing is the class this whole campaign
       *  is about (H19-79).
       *
       *  The mapping is the DOM's own, and it is the reason "named, never coded" stays true: a test still says what a
       *  PERSON pressed, and the driver derives the physical code the browser would have sent. Only the unambiguous
       *  cases are derived — a letter, a digit, a space, the named editing keys, and the left-hand modifier a lone
       *  `Shift`/`Control`/`Alt`/`Meta` means. Anything else keeps `code === key`, which is what it was. */
      async press({ key }) {
        const target = host.document.activeElement ?? host.document.body;
        const before = netCount();
        const code = keyCodeFor(key);
        for (const type of ["keydown", "keypress", "keyup"]) {
          target.dispatchEvent(new host.window.KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
        }
        await settleActions({ since: before });
        const followed = await follow();
        return { path: currentPath(), redirectedTo: followed };
      },
      /** End the session and re-render this route as the person now is — nobody.
       *
       *  ⚑ It DROPS THE TICKET AND RE-BOOTS rather than starting a fresh driver, and the difference is the whole point:
       *  a new driver proves what a stranger sees, while this proves what THIS browser sees after signing out — which is
       *  where a leak actually lives (a cached list still holding the last principal's rows, a gated route that does not
       *  re-check). Re-booting the SAME path is what makes the gate run again. */
      /** `Ui.SignInAs` — install a REAL session ticket as this browser's session, then re-render as that person.
       *
       *  ⚑ THE SAME THING `Session.SignIn` DOES IN THE PAGE, done from outside it: store the ticket and boot. So the app
       *  comes up through its ordinary gate — a route it may not see still bounces, a list still shows only that
       *  principal's rows. Nothing here asserts authority; it supplies a credential and lets the app decide.
       *
       *  STICKY, and legitimate BEFORE the first visit — a test's first act is usually to say who it is. The host falls
       *  back to this when the (not yet existing) window has no token, which is the same shape the pinned clock has. */
      async signinas({ ticket }) {
        host.setTicket(ticket ?? null);
        if (!host.ready) return { value: true };
        const here = currentPath() || "/";
        await hardNavigate(here, { token: host.ticket() });
        if (host.ticket() && !host.currentToken()) await hardNavigate("/", { token: host.ticket() });
        const followed = await follow();
        return { path: currentPath(), redirectedTo: followed };
      },
      async signout() {
        host.setTicket(null);
        host.clearStoredToken();
        const here = currentPath() || "/";
        await hardNavigate(here, { anonymous: true });
        const followed = await follow();
        return { path: currentPath(), redirectedTo: followed };
      },
      /** An explicit wait — the escape hatch for a flow whose completion the driver cannot observe. Deliberately last
       *  resort: everything else waits on an observable, and a test that needs this is telling you the driver is missing
       *  a signal. */
      async wait({ ms }) {
        await new Promise((r) => setTimeout(r, Number(ms) || 0));
        return { value: true };
      },
      /** ⭐ THE GEOMETRY — the questions every other verb here answers "fine" to while the screen is broken.
       *
       *  ⛔ NOT MEASURED IS NOT TRUE. happy-dom has no font engine and no compositor: every `getBoundingClientRect`
       *  it returns is 0×0 and nothing is ever on top of anything, so it cannot judge any of this. A renderer that
       *  CANNOT judge a claim must never report it as holding — that would put a written claim in the test file,
       *  reporting green about something nobody measured, which is worse than not having the assertion at all. The
       *  host says which it is; nothing here guesses from a zero, because a zero-sized box is ALSO a real defect and
       *  the two must not be confused.
       *
       *  ⚑ THE ANSWER CARRIES ITS NUMBERS. A geometric failure without them is nearly unactionable — "it is not
       *  clickable" sends the reader to look at the locator, which is the one thing that is right. What is ON TOP of
       *  it, by how many pixels it escaped its container, how much wider the document is than the window: that is the
       *  fix, and it is the difference between this and a red light. */
      async layout({ question, a, b }) {
        if (!host.canMeasureLayout) {
          return { measured: false, holds: false, why: host.whyNoLayout ?? "this renderer has no layout \u2014 run the same tests with `osy test --pixels`, which drives a real browser" };
        }
        const doc = host.document;
        const rect = (el) => el.getBoundingClientRect();
        const tagOf = (el) => `<${el?.tagName?.toLowerCase() ?? "?"}>`;
        const isBareText = (el) => (el?.children?.length ?? 0) === 0 && !["button", "a", "input", "select", "textarea"].includes((el?.tagName ?? "").toLowerCase());
        const boxHint = (e1, e2) => isBareText(e1) || isBareText(e2) ? " \u2691 These are the elements that READ those words, not the boxes around them. If you meant the panels, give each one a `label:` and name that \u2014 a container is named by its label, exactly as `within:` names one." : "";
        const overlaps = (r, c) => r.left < c.right && c.left < r.right && r.top < c.bottom && c.top < r.bottom;
        const describe = (el) => {
          const tag = el?.tagName?.toLowerCase() ?? "?";
          const text = collapse(el?.textContent ?? "").slice(0, 40);
          return text ? `<${tag}> "${text}"` : `<${tag}>`;
        };
        const locate = (label, verb) => {
          const found = findByAriaLabel(label, { exact: true, prefer: clickable }) ?? byText(label, { prefer: clickable }) ?? findByAriaLabel(label, { exact: true }) ?? byText(label);
          if (!found) {
            throw new Error(`no element matching '${label}'. What is currently reachable: ${reachableTexts().slice(0, 20).join(" \xB7 ") || "(nothing)"}${scopeNote()}`);
          }
          return verb === "click" ? clickableFor(found) : found;
        };
        if (question === "NoOccludedText") {
          const view = doc.defaultView ?? null;
          const positioned = (el) => {
            const p = view?.getComputedStyle?.(el)?.position;
            return p === "absolute" || p === "fixed" || p === "sticky";
          };
          const liftedUnder = (el, stop) => {
            for (let n = el; n && n !== stop; n = n.parentElement) if (positioned(n)) return true;
            return false;
          };
          const commonAncestor = (x, y) => {
            for (let n = x; n; n = n.parentElement) if (n.contains(y)) return n;
            return null;
          };
          const occluders = [...doc.querySelectorAll("button, a, input, select, textarea, [data-osy-onclick]")].filter((el) => clickable(el)).map((el) => ({ el, r: rect(el) })).filter(({ r }) => r.width > 1 && r.height > 1);
          const found = [];
          for (const t of doc.querySelectorAll("*")) {
            if (!isBareText(t)) continue;
            if (collapse(t.textContent ?? "").length === 0) continue;
            const tr = rect(t);
            if (tr.width <= 1 || tr.height <= 1) continue;
            for (const { el, r } of occluders) {
              if (el === t || el.contains(t) || t.contains(el)) continue;
              const left = Math.max(tr.left, r.left);
              const right = Math.min(tr.right, r.right);
              const top = Math.max(tr.top, r.top);
              const bottom = Math.min(tr.bottom, r.bottom);
              if (right - left <= 1 || bottom - top <= 1) continue;
              const root = commonAncestor(t, el);
              if (!root || liftedUnder(t, root) || liftedUnder(el, root)) continue;
              const hit = doc.elementFromPoint((left + right) / 2, (top + bottom) / 2);
              if (!hit || !(hit === el || el.contains(hit))) continue;
              found.push(`${describe(t)} is overlapped by ${describe(el)} \u2014 they intersect by ${Math.round(right - left)}\xD7${Math.round(bottom - top)}px, and the ${tagOf(el)} is what a person sees there.`);
              break;
            }
            if (found.length >= 5) break;
          }
          if (found.length === 0) return { measured: true, holds: true };
          return { measured: true, holds: false, detail: found.join("\n  \xB7 ") };
        }
        if (question === "NoOverflow") {
          const el = doc.documentElement;
          const over = el.scrollWidth - el.clientWidth;
          if (over <= 1) return { measured: true, holds: true };
          let worst = null;
          for (const n of doc.querySelectorAll("*")) {
            const r = rect(n);
            if (r.width === 0) continue;
            if (worst === null || r.right > worst.right) worst = { right: r.right, el: n };
          }
          return {
            measured: true,
            holds: false,
            detail: `the page is ${over}px wider than the window (${el.scrollWidth} vs ${el.clientWidth}), so it scrolls sideways. The furthest-right element is ${worst ? describe(worst.el) : "(none found)"}${worst ? `, ending at x=${Math.round(worst.right)}` : ""}.`
          };
        }
        if (question === "Clickable") {
          const el = locate(a, "click");
          const r = rect(el);
          if (r.width === 0 || r.height === 0) {
            return {
              measured: true,
              holds: false,
              detail: `'${a}' has an EMPTY box (${Math.round(r.width)}\xD7${Math.round(r.height)}) \u2014 it is in the DOM and takes up no space, so no person can press it. A parent with \`display:none\`, a zero height, or a collapsed flex child are the usual causes.`
            };
          }
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx < 0 || cy < 0 || cx > doc.documentElement.clientWidth || cy > doc.documentElement.clientHeight) {
            return {
              measured: true,
              holds: false,
              detail: `'${a}' is laid out OFF THE WINDOW \u2014 its centre is at (${Math.round(cx)}, ${Math.round(cy)}) and the window is ${doc.documentElement.clientWidth}\xD7${doc.documentElement.clientHeight}. It cannot be clicked where it is.`
            };
          }
          const hit = doc.elementFromPoint(cx, cy);
          if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return { measured: true, holds: true };
          return {
            measured: true,
            holds: false,
            detail: `a click at '${a}'s own centre (${Math.round(cx)}, ${Math.round(cy)}) lands on ${hit ? describe(hit) : "nothing"} instead \u2014 something is covering it. That is what a person pressing it would hit, so the control is on screen and unusable.`
          };
        }
        if (question === "Inside") {
          const el = locate(a, "any");
          const box = resolveWithin(scopeRoot(), b);
          const r = rect(el);
          const c = rect(box);
          const out = [];
          if (r.left < c.left - 1) out.push(`${Math.round(c.left - r.left)}px past its LEFT edge`);
          if (r.right > c.right + 1) out.push(`${Math.round(r.right - c.right)}px past its RIGHT edge`);
          if (r.top < c.top - 1) out.push(`${Math.round(c.top - r.top)}px past its TOP edge`);
          if (r.bottom > c.bottom + 1) out.push(`${Math.round(r.bottom - c.bottom)}px past its BOTTOM edge`);
          if (out.length === 0) return { measured: true, holds: true };
          return {
            measured: true,
            holds: false,
            detail: `'${a}' is laid out ${out.join(" and ")} of '${b}'. Its box is (${Math.round(r.left)}, ${Math.round(r.top)}) ${Math.round(r.width)}\xD7${Math.round(r.height)}; the container's is (${Math.round(c.left)}, ${Math.round(c.top)}) ${Math.round(c.width)}\xD7${Math.round(c.height)}.`
          };
        }
        const AXIS = {
          // [what must be true, how to say it when it is not] — the four are one comparison with four spellings, and
          // the spelling is the part that matters at the moment somebody reads a failure.
          Above: {
            holds: (r, c) => r.bottom <= c.top + 1,
            word: "above",
            say: (r, c) => `it ends at y=${Math.round(r.bottom)} and the other starts at y=${Math.round(c.top)}`
          },
          Below: {
            holds: (r, c) => r.top >= c.bottom - 1,
            word: "below",
            say: (r, c) => `it starts at y=${Math.round(r.top)} and the other ends at y=${Math.round(c.bottom)}`
          },
          LeftOf: {
            holds: (r, c) => r.right <= c.left + 1,
            word: "to the left of",
            say: (r, c) => `it ends at x=${Math.round(r.right)} and the other starts at x=${Math.round(c.left)}`
          },
          RightOf: {
            holds: (r, c) => r.left >= c.right - 1,
            word: "to the right of",
            say: (r, c) => `it starts at x=${Math.round(r.left)} and the other ends at x=${Math.round(c.right)}`
          }
        };
        if (AXIS[question]) {
          const { holds, word, say } = AXIS[question];
          const e1 = locate(a, "any");
          const e2 = locate(b, "any");
          const r = rect(e1);
          const c = rect(e2);
          if (holds(r, c)) return { measured: true, holds: true };
          return {
            measured: true,
            holds: false,
            detail: `'${a}' ${tagOf(e1)} is not laid out ${word} '${b}' ${tagOf(e2)} \u2014 ${say(r, c)}, so they ${overlaps(r, c) ? "OVERLAP" : "are the other way round"}.${boxHint(e1, e2)} \u2691 This is about where they ARE. \`Assert.Before\` asks a different question \u2014 DOCUMENT order among a list's rows \u2014 and the two disagree exactly when the app reorders visually.`
          };
        }
        if (question === "Wider" || question === "Narrower" || question === "SameWidth") {
          const e1 = locate(a, "any");
          const e2 = locate(b, "any");
          const r = rect(e1);
          const c = rect(e2);
          const w1 = Math.round(r.width);
          const w2 = Math.round(c.width);
          const ok = question === "Wider" ? r.width > c.width + 1 : question === "Narrower" ? r.width + 1 < c.width : Math.abs(r.width - c.width) <= 1;
          if (ok) return { measured: true, holds: true };
          const how = w1 === w2 ? "they are the same width" : w1 > w2 ? `'${a}' is ${w1 - w2}px WIDER` : `'${a}' is ${w2 - w1}px NARROWER`;
          return {
            measured: true,
            holds: false,
            detail: `'${a}' ${tagOf(e1)} is ${w1}px wide and '${b}' ${tagOf(e2)} is ${w2}px \u2014 ${how}.` + boxHint(e1, e2)
          };
        }
        if (question === "FitsOn") {
          const found = locate(a, "any");
          const targets = [found];
          const named = found.tagName === "LABEL" && found.htmlFor ? doc.getElementById(found.htmlFor) : null;
          if (named && named !== found) targets.push(named);
          for (const el of targets) {
            const cs = el.tagName === "INPUT" ? doc.defaultView?.getComputedStyle?.(el) : null;
            const shown = cs ? el.value ? String(el.value) : String(el.placeholder ?? "") : "";
            if (shown) {
              const cv = doc.createElement("canvas")?.getContext?.("2d");
              if (cv) {
                cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                const inner = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
                const need = cv.measureText(shown).width;
                if (need > inner + 1) {
                  return {
                    measured: true,
                    holds: false,
                    detail: `'${a}' is a ${Math.round(el.clientWidth)}px input whose ${el.value ? "value" : "placeholder"} needs ${Math.round(need)}px in a ${Math.round(inner)}px content box, so ${Math.round(need - inner)}px of it is CUT OFF on screen. It reads "${shown.slice(0, 80)}${shown.length > 80 ? "\u2026" : ""}" to the DOM, which is why every text assertion passes on it \u2014 and an <input> reports scrollWidth === clientWidth whatever it is showing, which is why no other layout claim can see it either. Give the field the width it needs, or shorten the text.`
                  };
                }
              }
              continue;
            }
            const overX = el.scrollWidth - el.clientWidth;
            const overY = el.scrollHeight - el.clientHeight;
            if (overX <= 1 && overY <= 1) continue;
            const full = collapse(el.textContent ?? "");
            const which = [];
            if (overX > 1) which.push(`${overX}px WIDER than its box`);
            if (overY > 1) which.push(`${overY}px TALLER than its box`);
            const whose = el === found ? "" : ` (the ${el.tagName.toLowerCase()} it labels)`;
            return {
              measured: true,
              holds: false,
              detail: `'${a}'${whose} has content ${which.join(" and ")} (box ${el.clientWidth}\xD7${el.clientHeight}, content ${el.scrollWidth}\xD7${el.scrollHeight}), so part of it is CUT OFF on screen. It reads "${full.slice(0, 80)}${full.length > 80 ? "\u2026" : ""}" to the DOM, which is why every text assertion passes on it.`
            };
          }
          return { measured: true, holds: true };
        }
        throw new Error(`unknown layout question '${question}'`);
      },
      /** ⭐ PHOTOGRAPH THE PAGE — `Ui.Shot("the empty board")`.
       *
       *  ⛔ IT ASSERTS NOTHING, AND THAT IS WHAT LETS BOTH TIERS RUN THE SAME TEST FILE. happy-dom has no font engine
       *  and no compositor, so there is no pixel for it to write — and the host says so rather than refusing, because
       *  refusing would make a `.test.osy` containing one runnable under `--pixels` and NOT under `osy test`. That
       *  tier-specific test file is exactly what the pixel arc exists to avoid, and the usual objection does not
       *  apply: "a swallowed failure must not leave an affordance inert" is about a control that looks live and does
       *  nothing, where the person believes something happened. Nothing is claimed here, so the verdict is identical
       *  either way — and the run REPORTS which answer it got, so "no image" can never read as "the image is fine".
       *
       *  ⚠ What no tier may do is write a DOM dump under the same name. An artifact that is not a photograph, filed
       *  where a photograph was asked for, is worse than the absence of one. */
      async shot({ label }) {
        return host.shot(String(label ?? "shot"));
      },
      async snapshot() {
        return { value: host.snapshot() };
      },
      /** Who the client is signed in AS — `Ui.CurrentUser` in the design's vocabulary (§6/§8).
       *
       *  Read from the ticket the client is holding rather than from a probe field, because the ticket IS the session:
       *  it is what every subsequent request carries, so decoding it answers "who will the server think I am" rather
       *  than "who did some UI once say I was". Null when anonymous, which is the honest answer for a visitor who has
       *  not signed in — never an empty object that reads like a user with no name. */
      async session() {
        const token = host.currentToken();
        if (!token) return { value: null };
        const [, payload] = token.split(".");
        if (!payload) return { value: { token: true } };
        try {
          const claims = JSON.parse(fromBase64Url(payload));
          return { value: { email: claims.email ?? claims.sub ?? null, claims } };
        } catch {
          return { value: { token: true } };
        }
      }
    };
    function currentPath() {
      return host.currentPath();
    }
    async function hardNavigate(path, opts) {
      await host.load(path, opts);
      consumedChanges.clear();
      softDepth = 0;
      await settle({ since: 0 });
      await settleNavigations();
      await host.live.waitSubscribed();
      await host.live.waitBooted?.();
      await host.live.waitPainted?.();
      await host.live.waitLoaded?.();
      await settleControlMounts();
    }
    return {
      commands,
      currentPath,
      recordNavigation,
      settle,
      settleActions,
      settleNavigations,
      netCount,
      follow,
      pickInOpenPicker,
      takeExpiredWaits
    };
  }
  return __toCommonJS(ui_verbs_exports);
})();
globalThis.OsyUiVerbs = OsyUiVerbs;
