"use strict";
var OsyUiDom = (() => {
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

  // scripts/lib/ui-dom.mjs
  var ui_dom_exports = {};
  __export(ui_dom_exports, {
    ITEM_ATTR: () => ITEM_ATTR,
    createUiDom: () => createUiDom,
    renderedTextsIn: () => renderedTextsIn
  });
  var ITEM_ATTR = "data-osy-item";
  function controlOwnLabel(el) {
    const tag = (el.tagName ?? "").toLowerCase();
    const role = el.getAttribute?.("role") ?? "";
    const isControl = tag === "button" || tag === "a" || tag === "summary" || ["button", "link", "checkbox", "switch", "tab", "menuitem", "radio"].includes(role);
    if (!isControl) return "";
    if ((el.textContent ?? "").trim()) return "";
    return (el.getAttribute?.("aria-label") ?? "").trim();
  }
  function renderedTextsIn(root, { includeFieldValues = false } = {}) {
    const out = [];
    const walk = (el) => {
      const own = controlOwnLabel(el);
      if (own) {
        out.push(own);
        return;
      }
      for (const c of el.children ?? []) walk(c);
      if ((el.children?.length ?? 0) !== 0) return;
      if (includeFieldValues) {
        const tag = (el.tagName ?? "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") {
          const v = String(el.value ?? "").trim();
          if (v) out.push(v);
          return;
        }
      }
      const t = el.textContent?.trim();
      if (t) out.push(t);
    };
    walk(root);
    return out;
  }
  function createUiDom(env) {
    let withinScope = null;
    function scopeRoot() {
      const app = env.document.getElementById("app") ?? env.document.body;
      const dialogs = app.querySelectorAll('[data-osy-dialog], [role="dialog"]');
      const base = dialogs.length > 0 ? dialogs[dialogs.length - 1] : app;
      if (withinScope === null) return base;
      return withinScope.reduce((root, segment) => resolveWithin(root, segment), base);
    }
    function resolveWithin(base, scope) {
      const baseName = base.getAttribute?.("aria-label");
      if (baseName != null && baseName === scope) return base;
      const isContainable = (el) => !["input", "textarea", "select", "img", "br", "hr"].includes((el.tagName ?? "").toLowerCase());
      const nameOf = (el) => el.getAttribute?.("aria-label") ?? "";
      const nameable = [...base.querySelectorAll("[aria-label]")].filter(isContainable);
      const namedExact = nameable.filter((el) => nameOf(el) === scope);
      const rowsExact = rowsNamed(base, scope, { exact: true });
      const exactHits = [...namedExact, ...rowsExact];
      const named = disjointDeepest(exactHits.length > 0 ? namedExact : nameable.filter((el) => nameOf(el).includes(scope)));
      const rows = disjointDeepest(exactHits.length > 0 ? rowsExact : rowsNamed(base, scope));
      const all = disjointDeepest([.../* @__PURE__ */ new Set([...named, ...rows])]);
      if (all.length === 0 && baseName != null && baseName.includes(scope)) return base;
      if (all.length === 0) {
        if (looksLikeRowIdentity(scope)) throw new Error(rowIdentityNotOnScreen(base, scope));
        const asText = textElementsReading(base, scope);
        if (asText.length > 0) throw new Error(scopeIsTextNotAContainer(base, scope, asText));
        throw new Error(
          `within: '${scope}' \u2014 no container whose \`label:\` is or contains those words, no row reading them and nothing that reads them at all ${withinBaseDescription(base)}. A container is named by its \`label:\`; a row by what it reads (its first cell), or by the row itself when a test is holding one. Rows on screen: ${renderedRows(base).map((r) => r.name || r.id).join(" \xB7 ") || "(none)"}`
        );
      }
      if (all.length > 1) {
        const ids = all.map((el) => el.getAttribute?.(ITEM_ATTR)).filter((v) => v);
        const oneItemTwice = ids.length === all.length && new Set(ids).size === 1;
        throw new Error(
          `within: '${scope}' matches ${all.length} different things, so the scope is ambiguous:
${describeCandidates(all, { named: new Set(named), rows: new Set(rows) })}
` + (oneItemTwice ? `Those are the SAME item (\`${ids[0]}\`) rendered twice, so nothing about the rows can tell them apart \u2014 a row is matched by its identity before its text, and renaming what they render will not help. Say which RENDERING you mean by scoping to the list that holds it: scopes compose, outer first \u2014 \`Ui.Within("<the list>") { \u2026 within: "${scope}" \u2026 }\`.` : 'Name something unique \u2014 one word meaning two things on screen is not something to resolve by guessing. Give the container you mean a `label:` and scope to that, or wrap the call in `Ui.Within("<the container>") { \u2026 }`, which narrows before this scope is looked for.')
        );
      }
      return liftOffALeaf(all[0], base);
    }
    function liftOffALeaf(el, base) {
      if (!el || el === base) return el;
      const isControl = (n) => {
        const tag = (n?.tagName ?? "").toLowerCase();
        return tag === "button" || tag === "a" || tag === "input" || tag === "select" || tag === "textarea" || n?.getAttribute?.("role") === "button";
      };
      if (!isControl(el)) return el;
      const holds = (n) => n?.querySelectorAll?.('button, a, input, select, textarea, [role="button"]').length ?? 0;
      for (let up = el.parentElement; up && up !== base?.parentElement; up = up.parentElement) {
        if (holds(up) > 0) return up;
        if (up === base) break;
      }
      return el;
    }
    function looksLikeRowIdentity(scope) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(scope).trim());
    }
    function rowIdentityNotOnScreen(base, scope) {
      const rows = renderedRows(base);
      let why;
      if (rows.length > 0) {
        why = `The rows that ARE on screen: ${rows.map((r) => `\`${r.id}\`${r.name ? ` ("${r.name}")` : ""}`).join(" \xB7 ")}. So the screen is rendering rows and this is not one of them \u2014 a different list, a filter that excludes it, or a row created after this screen was drawn.`;
      } else if (screenIsEmpty(base)) {
        why = "NOTHING here is rendering rows at all, and the screen is empty \u2014 so look at the screen before the locator: the page may have rendered nothing (a query that returned no rows, a guard that redirected, or a render that failed), and `Assert.Visible` on anything the page should show will say which.";
      } else {
        why = `The screen is NOT empty \u2014 it reads ${screenSample(base)} \u2014 but not one element on it carries a row identity, so there is no row for ANY id to match. A row is stamped with its entity's id only when the \`foreach\` iterates the ENTITY itself; a \`foreach\` over a wrapper class, a projection or a tuple renders the same pixels and stamps nothing, which is what this screen looks like. Either iterate the entity \u2014 \`foreach (var job in jobs)\`, reading the wrapper's parts inside the body \u2014 and keep \`within: <the row>\`, or scope by words the row actually reads, e.g. \`within: "` + (firstRowishText(base) ?? "Some row") + '"`.';
      }
      return `within: '${scope}' \u2014 that is a ROW IDENTITY (an entity's id, which is what \`Ui.Within(<a row>)\` sends), and no row with it is rendered ${withinBaseDescription(base)}. ` + why + " (Nothing here is about naming: a row named by its identity needs no `label:`.)";
    }
    function screenIsEmpty(base) {
      return collapse(base.textContent).length === 0;
    }
    function screenSample(base) {
      const words = collapse(base.textContent);
      const shown = words.length > 160 ? `${words.slice(0, 160)}\u2026` : words;
      return `"${shown}"`;
    }
    function firstRowishText(base) {
      for (const el of base.querySelectorAll("*")) {
        if (el.children.length > 0) continue;
        const t = collapse(el.textContent);
        if (t.length >= 2 && t.length <= 40) return t.replace(/"/g, "");
      }
      return null;
    }
    function textElementsReading(base, scope) {
      const wanted = collapse(scope);
      if (!wanted) return [];
      const all = [...base.querySelectorAll("*")];
      const exact = disjointDeepest(all.filter((el) => collapse(el.textContent) === wanted));
      if (exact.length > 0) return exact;
      return disjointDeepest(all.filter((el) => collapse(el.textContent).includes(wanted)));
    }
    function scopeIsTextNotAContainer(base, scope, hits) {
      const el = hits[0];
      const named = enclosingScopeOf(el);
      const block = el.parentElement;
      const siblings = block ? [...block.children].filter((c) => c !== el).length : 0;
      const offered = scopableNames(base);
      const modal = typeof base.closest === "function" ? base.closest('[data-osy-dialog], [role="dialog"]') ?? (base.matches?.('[data-osy-dialog], [role="dialog"]') ? base : null) : null;
      const modalName = modal ? modal.getAttribute("aria-label") : null;
      const confined = modal ? `A DIALOG IS OPEN${modalName ? ` ("${modalName}")` : ""}, so every locator \u2014 this one included \u2014 reaches only INSIDE it. That is what a modal is: the page behind a scrim is inert, and a row back there is not yours to click until the dialog closes. So the names below are the DIALOG's, not the page's. ` : "";
      return confined + `within: '${scope}' \u2014 those words ARE on screen (which is why \`Assert.Visible("${scope}")\` passes): they are the text of a <${describedTagOf(el)}>` + (named ? `, inside the container named "${named}"` : ", inside nothing that carries a `label:`") + `. But a scope selects a CONTAINER by its \`label:\`, and TEXT is not a container \u2014 a heading does not scope the block under it, because a rendered heading is a span with a font size: nothing ties it to the block it introduces. Name that block and scope to the name: ` + (block && siblings > 0 ? `it is the <${block.tagName.toLowerCase()}> holding this text and ${siblings} more element(s) \u2014 ` : "") + `\`Stack(label: "${scope}") { Text("${scope}"); \u2026 }\`, then \`within: "${scope}"\` selects it. Containers you can scope to ${modal ? "inside that dialog" : "on this screen"} right now: ` + (offered.inside.length > 0 ? offered.inside.map((n) => `'${n}'`).join(" \xB7 ") : offered.active.length > 0 ? "(none new)" : named ? `(none \u2014 "${named}" is the nearest name above this text, but it is not one \`within:\` can select from here)` : "(none \u2014 nothing here carries a `label:` yet)") + (offered.active.length > 0 ? `. Already in force, so scoping to ${offered.active.length > 1 ? "them" : "it"} narrows nothing: ` + offered.active.map((n) => `'${n}'`).join(" \xB7 ") : "") + `. Rows on screen: ${renderedRows(base).map((r) => r.name || r.id).join(" \xB7 ") || "(none)"}`;
    }
    function isScopeableContainer(el) {
      return !!el?.getAttribute?.("aria-label") && (el.children?.length ?? 0) > 0 && !isClickable(el) && !["input", "textarea", "select", "img"].includes((el.tagName ?? "").toLowerCase());
    }
    function scopableNames(base) {
      const inside = [...base.querySelectorAll("[aria-label]")].filter(isScopeableContainer).map((el) => el.getAttribute("aria-label")).filter((n) => n);
      const app = base.ownerDocument?.getElementById?.("app") ?? null;
      const active = [];
      for (let p = base; p; p = p.parentElement) {
        if (isScopeableContainer(p)) active.push(p.getAttribute("aria-label"));
        if (p === app || p !== base && dialogNameOf(p) !== null) break;
      }
      const uniqueActive = [...new Set(active)];
      const uniqueInside = [...new Set(inside)].filter((n) => !uniqueActive.includes(n));
      return {
        inside: uniqueInside.length > 8 ? [...uniqueInside.slice(0, 8), `\u2026and ${uniqueInside.length - 8} more`] : uniqueInside,
        active: uniqueActive
      };
    }
    function dialogNameOf(el) {
      if (!el || typeof el.getAttribute !== "function") return null;
      return el.getAttribute("data-osy-dialog") ?? (el.getAttribute("role") === "dialog" ? el.getAttribute("aria-label") || "" : null);
    }
    function withinBaseDescription(base) {
      const name = dialogNameOf(base);
      return name !== null ? name === "" ? "inside the open dialog" : `inside the open dialog '${name}'` : "on this screen";
    }
    function openDialogName() {
      const app = env.document.getElementById("app") ?? env.document.body;
      const dialogs = app.querySelectorAll('[data-osy-dialog], [role="dialog"]');
      return dialogs.length > 0 ? dialogNameOf(dialogs[dialogs.length - 1]) : null;
    }
    function vanishedNote(label) {
      if (lastInteraction === null || !lastInteraction.before.some((t) => t.includes(String(label)))) return "";
      try {
        const stillThere = [...env.document.querySelectorAll("*")].some(
          (el) => (el.textContent ?? "").includes(String(label)) || (el.getAttribute?.("aria-label") ?? "").includes(String(label))
        );
        if (stillThere) return "";
      } catch {
      }
      const renamedTo = renameCandidate(lastInteraction, label);
      if (renamedTo !== null) return selfRenamingNote(label, lastInteraction, 1, renamedTo);
      return `
  \u2691 '${label}' WAS on screen until the \`${lastInteraction.verb}("${lastInteraction.label}")\` immediately before this \u2014 that action removed it from view. If that is what you expected, assert it: \`Assert.Hidden("${label}")\`. If you meant to read its state AFTER the act, the row is gone, so read the DATA instead of the screen. Nothing here is broken: the action ran and the page followed it.`;
    }
    function renameCandidate(culprit, label) {
      if (String(culprit.label) !== String(label)) return null;
      try {
        const before = new Set(culprit.before.map((t) => String(t).trim()));
        const appeared = reachableTexts().map((t) => String(t).trim()).filter((t) => t.length > 0 && !before.has(t));
        return appeared.length > 0 ? appeared[0] : null;
      } catch {
        return null;
      }
    }
    function selfRenamingNote(label, culprit, stepsAgo, renamedTo) {
      const when = stepsAgo <= 1 ? "immediately before this" : `${stepsAgo} steps before this`;
      return `
  \u2691 '${label}' WAS on screen until the \`${culprit.verb}("${culprit.label}")\` ${when} \u2014 and THAT WAS A PRESS ON THIS SAME LABEL, after which '${renamedTo}' appeared. So the control RENAMES ITSELF when it is used, and '${renamedTo}' is what it is called now. A caption that doubles as the control's state cannot be addressed twice by one name \u2014 not by a test, not by a script, not by anyone saying "click ${label}". Bind the state to a control that HOLDS it: \`Switch("${label}", value: <the flag>)\`, driven with \`Ui.Check\`/\`Ui.Uncheck\`, which SET a state rather than flipping whatever is there.`;
    }
    function vanishedEarlierNote(label) {
      if (interactionHistory.length === 0) return "";
      const want = String(label);
      let idx = -1;
      for (let i = interactionHistory.length - 1; i >= 0; i--) {
        if (interactionHistory[i].before.some((t) => t.includes(want))) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return "";
      const culprit = interactionHistory[idx];
      const stepsAgo = interactionHistory.length - idx;
      if (stepsAgo <= 1) return "";
      try {
        const stillThere = [...env.document.querySelectorAll("*")].some(
          (el) => (el.textContent ?? "").includes(want) || (el.getAttribute?.("aria-label") ?? "").includes(want)
        );
        if (stillThere) return "";
      } catch {
      }
      const renamedTo = renameCandidate(culprit, want);
      if (renamedTo !== null) return selfRenamingNote(want, culprit, stepsAgo, renamedTo);
      return `
  \u2691 '${want}' WAS on screen until the \`${culprit.verb}("${culprit.label}")\` ${stepsAgo} steps before this, and has not been back since. If that is what you expected, assert it: \`Assert.Hidden("${want}")\`. If you expected it back, whatever was meant to restore it did not.`;
    }
    let lastInteraction = null;
    let stagedInteraction = null;
    const interactionHistory = [];
    function recordInteraction(verb, label) {
      try {
        stagedInteraction = { verb, label: String(label), before: reachableTexts() };
      } catch {
        stagedInteraction = null;
      }
    }
    function interactionResolved() {
      if (stagedInteraction !== null) {
        lastInteraction = stagedInteraction;
        interactionHistory.push(stagedInteraction);
        stagedInteraction = null;
      }
    }
    function scopeNote() {
      if (withinScope !== null) {
        try {
          const root = scopeRoot();
          const shown = withinScope.map((x) => `'${x}'`).join(" \u25B8 ");
          const innermost = withinScope[withinScope.length - 1];
          const interactive = root.querySelectorAll('button, a, input, select, textarea, [role="button"]').length;
          const elsewhere = [...env.document.querySelectorAll("*")].filter(
            (el) => el !== root && !root.contains(el) && !el.contains(root) && (el.textContent ?? "").trim() === String(innermost).trim()
          ).length;
          return ` \u2014 NOTE: the search was narrowed to \`within: ${shown}\`, which resolved to a <${root.tagName?.toLowerCase() ?? "?"}> holding ${interactive} control(s)` + (interactive === 0 ? " \u2014 nothing inside it can be clicked" : "") + (elsewhere > 0 ? `. ${elsewhere} other element(s) on this page also read '${innermost}', so the scope may have resolved to the wrong one \u2014 name something unique to that row, or put the whole thing inside a \`Ui.Within("<the container>")\`, which narrows before this segment is looked for.` : ".");
        } catch {
        }
      }
      const name = openDialogName();
      return name === null ? "" : ` \u2014 NOTE: the dialog '${name}' is open, and everything behind a modal is inert, so only what is INSIDE it can be reached. Close or answer the dialog first if you meant the page behind it.`;
    }
    function readableTexts() {
      const own = renderedTextsIn(textRoot());
      if (withinScope !== null) return own;
      return [...own, ...chromeOutsideApp().flatMap((n) => renderedTextsIn(n))];
    }
    function reachableTexts() {
      const own = renderedTextsIn(scopeRoot());
      if (withinScope !== null) return own;
      return [...own, ...chromeOutsideApp().flatMap((n) => renderedTextsIn(n))];
    }
    function textRoot() {
      if (withinScope === null) return env.document.getElementById("app") ?? env.document.body;
      return scopeRoot();
    }
    function chromeOutsideApp() {
      const app = env.document.getElementById("app");
      if (!app) return [];
      return [...env.document.querySelectorAll(".osy-action-failed")].filter((n) => !app.contains(n));
    }
    function collapse(s) {
      return String(s ?? "").replace(/\s+/g, " ").trim();
    }
    function canonicalProbeValue(v) {
      if (v === null || v === void 0) return { isNull: true, text: null };
      if (typeof v === "boolean") return { isNull: false, text: v ? "true" : "false" };
      if (typeof v === "number") return { isNull: false, text: String(v) };
      return { isNull: false, text: String(v) };
    }
    function candidates() {
      const own = [...scopeRoot().querySelectorAll("*")];
      if (withinScope !== null) return own;
      return [...own, ...chromeOutsideApp().flatMap((n) => [n, ...n.querySelectorAll("*")])];
    }
    function mimeFor(name) {
      const ext = String(name).toLowerCase().replace(/^.*\./, "");
      return {
        md: "text/markdown",
        markdown: "text/markdown",
        txt: "text/plain",
        csv: "text/csv",
        json: "application/json",
        xml: "application/xml",
        html: "text/html",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        pdf: "application/pdf"
      }[ext] ?? "application/octet-stream";
    }
    function accessibleName(el) {
      const label = el.getAttribute?.("aria-label");
      if (label) return label;
      const ids = (el.getAttribute?.("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
      if (ids.length) {
        const named = ids.map((id) => env.document?.getElementById(id)).filter(Boolean).map((n) => accessibleName(n)).filter(Boolean).join(" ");
        if (named) return named;
      }
      const ownId = el.getAttribute?.("id");
      if (ownId) {
        const pointing = [...env.document?.querySelectorAll("label[for]") ?? []].find((l) => l.getAttribute("for") === ownId);
        if (pointing) {
          const named = accessibleName(pointing);
          if (named) return named;
        }
      }
      const wrapping = el.closest?.("label");
      if (wrapping && wrapping !== el) {
        const named = accessibleName(wrapping);
        if (named) return named;
      }
      const out = [];
      const walk = (node) => {
        if (node.getAttribute?.("aria-hidden") === "true") return;
        if ((node.children?.length ?? 0) === 0) {
          const t = node.textContent?.trim();
          if (t) out.push(t);
          return;
        }
        for (const c of node.children) walk(c);
      };
      walk(el);
      return out.join(" ").trim();
    }
    function keyCodeFor(key) {
      if (typeof key !== "string" || key.length === 0) return key;
      if (key.length === 1) {
        const c = key.toUpperCase();
        if (c >= "A" && c <= "Z") return `Key${c}`;
        if (key >= "0" && key <= "9") return `Digit${key}`;
        if (key === " ") return "Space";
        return key;
      }
      const named = {
        Enter: "Enter",
        Escape: "Escape",
        Tab: "Tab",
        Backspace: "Backspace",
        Delete: "Delete",
        ArrowUp: "ArrowUp",
        ArrowDown: "ArrowDown",
        ArrowLeft: "ArrowLeft",
        ArrowRight: "ArrowRight",
        Home: "Home",
        End: "End",
        PageUp: "PageUp",
        PageDown: "PageDown",
        Shift: "ShiftLeft",
        Control: "ControlLeft",
        Alt: "AltLeft",
        Meta: "MetaLeft"
      };
      return named[key] ?? key;
    }
    function disjointDeepest(hits) {
      return hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    }
    function rowName(el) {
      const cells = [...el.querySelectorAll('[role="gridcell"], [role="cell"]')];
      const source = cells.length > 0 ? cells[0] : el;
      return renderedTextsIn(source, { includeFieldValues: true }).join(" ").trim();
    }
    function renderedRows(root) {
      const rows = [];
      let last = null;
      for (const el of root.querySelectorAll(`[${ITEM_ATTR}]`)) {
        const id = el.getAttribute(ITEM_ATTR);
        if (id === last) continue;
        last = id;
        rows.push({ el, id, name: rowName(el) });
      }
      return rows;
    }
    function rowsNamed(root, name, { exact = false } = {}) {
      const rows = renderedRows(root);
      const wanted = String(name);
      const byIdentity = rows.filter((r) => r.id === wanted);
      if (byIdentity.length > 0) return byIdentity.map((r) => r.el);
      const exactly = rows.filter((r) => r.name === wanted);
      if (exactly.length > 0 || exact) return exactly.map((r) => r.el);
      return rows.filter((r) => r.name.includes(wanted)).map((r) => r.el);
    }
    function enclosingScopeOf(el) {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const name = p.getAttribute?.("aria-label");
        if (name) return name;
      }
      return null;
    }
    function enclosingItemOf(el) {
      for (let p = el; p; p = p.parentElement) {
        const id = p.getAttribute?.(ITEM_ATTR);
        if (id) return id;
      }
      return null;
    }
    function isFieldElement(el) {
      return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA";
    }
    function fieldNameOf(el) {
      return accessibleName(el) || el.getAttribute?.("placeholder") || el.getAttribute?.("name") || "(unnamed)";
    }
    const SCOPING_DOC = " \u2014 `osy docs testing-ui#matching` is the table of what a scope matches.";
    function narrowingAdvice(pool, fallback) {
      const scopeOf = new Map(pool.map((el) => [el, enclosingScopeOf(el)]));
      const inRows = pool.filter((el) => !scopeOf.get(el) && enclosingItemOf(el));
      const unreachable = pool.filter((el) => !scopeOf.get(el) && !enclosingItemOf(el));
      const clauses = [];
      if (inRows.length > 0) {
        const seen = /* @__PURE__ */ new Map();
        for (const el of inRows) {
          const id = enclosingItemOf(el);
          if (!seen.has(id)) seen.set(id, rowHandle(enclosingItemElementOf(el), id));
        }
        const handles = [...seen.values()];
        const readable = [...seen.entries()].filter(([, h]) => h.startsWith("reading ")).map(([, h]) => h.slice("reading ".length));
        clauses.push(
          `${inRows.length === pool.length ? "Each of these" : `${inRows.length} of these`} sits in a ROW (${handles.join(", ")}), which \`within:\` CAN reach: scope to the row holding the one you mean \u2014 ` + (readable.length > 0 ? `\`Ui.Within(${readable[0]}) { \u2026 }\`` : '`Ui.Within("<what that row reads>") { \u2026 }`') + ", or `Ui.Within(<the row>)` when a fixture is holding it."
        );
      }
      if (unreachable.length > 0) {
        clauses.push(
          `\u26A0 ${unreachable.length === pool.length ? "None" : `${unreachable.length}`} of them sit inside anything carrying a \`label:\` or in a row, so \`within:\` cannot select ` + (unreachable.length === pool.length ? "any of them" : "those") + ' \u2014 give the container you mean a `label:` first (`Stack(label: "Add a plant") { \u2026 }`), then scope to that name. A candidate already shown as `inside within: "\u2026"` is the one scoping CAN reach today.'
        );
      }
      if (clauses.length === 0) clauses.push(fallback);
      return clauses.join(" ");
    }
    function describeCandidates(els, why) {
      const shown = els.slice(0, 6);
      const lines = shown.map((el) => describeOneCandidate(el, why));
      const twinned = new Set(lines.filter((line, i) => lines.indexOf(line) !== i));
      return shown.map((el, i) => {
        if (!twinned.has(lines[i])) return `  ${i + 1}. ${lines[i]}`;
        const where = candidateCoordinate(el);
        const sameSpot = shown.some((o, j) => j !== i && lines[j] === lines[i] && candidateCoordinate(o) === where);
        return `  ${i + 1}. ${lines[i]}` + (where ? `, ${where}` : "") + (sameSpot || !where ? ` (#${i + 1} of ${els.length} in document order)` : "");
      }).join("\n") + (els.length > 6 ? `
  \u2026and ${els.length - 6} more` : "");
    }
    function describeOneCandidate(el, why) {
      const field = isFieldElement(el);
      const t = field ? fieldNameOf(el) : el.getAttribute?.("aria-label") || (el.textContent ?? "").trim().replace(/\s+/g, " ");
      const scope = enclosingScopeOf(el);
      const rowId = el.getAttribute?.(ITEM_ATTR);
      const asRow = rowId ? `a ROW ${rowHandle(el, rowId)}` : "a ROW reading that name";
      const kind = why?.named?.has(el) && why?.rows?.has(el) ? `both a \`label:\` and ${asRow}` : why?.named?.has(el) ? "a container carrying `label:`" : why?.rows?.has(el) ? asRow : "a match";
      const inRow = rowId ? null : enclosingItemOf(el);
      const inRowEl = inRow ? enclosingItemElementOf(el) : null;
      return `<${field ? (el.tagName ?? "?").toLowerCase() : describedTagOf(el)}> "${t.length > 60 ? `${t.slice(0, 60)}\u2026` : t}" \u2014 ${kind}` + (scope ? `, inside \`within: "${scope}"\`` : inRow ? "" : ", inside nothing that carries a `label:`") + (inRow ? `, in the row ${rowHandle(inRowEl, inRow)}` : "");
    }
    function rowHandle(el, id) {
      const name = el ? rowName(el) : null;
      return name ? `reading "${name.length > 40 ? `${name.slice(0, 40)}\u2026` : name}"` : `for item \`${id}\``;
    }
    function enclosingItemElementOf(el) {
      for (let p = el; p; p = p.parentElement) {
        if (p.getAttribute?.(ITEM_ATTR)) return p;
      }
      return null;
    }
    function describedTagOf(el) {
      const own = (el.tagName ?? "?").toLowerCase();
      if (el.getAttribute?.("aria-label")) return withRole(el, own);
      const target = clickTargetOf(el);
      return target && target !== el ? withRole(target, (target.tagName ?? "?").toLowerCase()) : withRole(el, own);
    }
    function withRole(el, tag) {
      const role = el.getAttribute?.("role");
      return role ? `${tag} role="${role}"` : tag;
    }
    function candidateCoordinate(el) {
      const anchor = clickTargetOf(el) ?? el;
      const root = coordinateRoot(anchor);
      if (!root) return null;
      let found = null;
      let reached = false;
      const walk = (node) => {
        if (reached) return;
        if (node === anchor) {
          reached = true;
          return;
        }
        if (node.getAttribute?.("aria-hidden") === "true") return;
        if (node !== root && isClickable(node)) return;
        if ((node.children?.length ?? 0) === 0) {
          const t = collapse(node.textContent);
          if (t) found = t;
          return;
        }
        for (const c of node.children) {
          walk(c);
          if (reached) return;
        }
      };
      walk(root);
      if (!reached || !found) return null;
      return `after "${found.length > 40 ? `${found.slice(0, 40)}\u2026` : found}"`;
    }
    function coordinateRoot(el) {
      const doc = el?.ownerDocument;
      if (!doc) return null;
      const app = doc.getElementById?.("app");
      return app && app.contains(el) ? app : doc.body ?? null;
    }
    function isClickable(el) {
      return el.tagName === "BUTTON" || el.tagName === "A" || el.hasAttribute?.("data-osy-onclick") === true;
    }
    function byText(text, { exact = false, prefer = null } = {}) {
      const hits = candidates().filter((el) => {
        const t = el.textContent?.trim() ?? "";
        return exact ? t === text : t.includes(text);
      });
      const deepest = disjointDeepest(hits);
      if (deepest.length <= 1) return deepest[0] ?? null;
      const exactly = deepest.filter((el) => (el.textContent?.trim() ?? "") === text);
      if (exactly.length === 1) return exactly[0];
      let pool = exactly.length > 1 ? exactly : deepest;
      if (prefer) {
        const able = pool.filter(prefer);
        if (able.length === 1) return able[0];
        if (able.length > 1) pool = able;
      }
      throw new Error(
        `'${text}' matches ${pool.length} different elements, so which one was meant is ambiguous:
${describeCandidates(pool)}
` + narrowingAdvice(pool, "Narrow it with `Ui.Within(<container or row>) { \u2026 }`, or name something unique.") + " (Refused rather than picking one: the choice would be an accident of how deeply the app happens to nest them.)" + SCOPING_DOC
      );
    }
    function findByAriaLabel(label, { exact = false, prefer = null } = {}) {
      const named = candidates().filter((el) => el.getAttribute("aria-label") !== null);
      const exactly = named.filter((el) => el.getAttribute("aria-label") === label);
      const wide = exactly.length > 0 ? exactly : exact ? [] : named.filter((el) => el.getAttribute("aria-label").includes(label));
      const pool = prefer && wide.some(prefer) ? wide.filter(prefer) : wide;
      if (prefer && pool.length > 0 && !pool.some(prefer)) return null;
      const deepest = disjointDeepest(pool);
      if (deepest.length <= 1) return deepest[0] ?? null;
      throw new Error(
        `'${label}' is the accessible name of ${deepest.length} different elements, so which was meant is ambiguous:
${describeCandidates(deepest)}
Narrow it with \`Ui.Within(<container or row>) { \u2026 }\`, or give them distinct labels.` + SCOPING_DOC
      );
    }
    function depth(el) {
      let d = 0;
      for (let p = el.parentElement; p; p = p.parentElement) d++;
      return d;
    }
    function clickableFor(el) {
      return clickTargetOf(el) ?? el;
    }
    const clickable = (el) => clickTargetOf(el) !== null;
    function clickTargetOf(el) {
      for (let p = el; p; p = p.parentElement) {
        if (p.tagName === "BUTTON" || p.tagName === "A" || p.hasAttribute?.("data-osy-onclick")) return p;
      }
      return null;
    }
    function fields() {
      return candidates().filter((el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    }
    function fieldFor(label) {
      const inputs = fields();
      const pick = (matches, tier, { exactly = false } = {}) => {
        if (matches.length <= 1) return matches[0] ?? null;
        const fallback = exactly ? "Narrow it with `Ui.Within(<container or row>) { \u2026 }`, or give them distinct `label:`s \u2014 two fields answering to one name is something only the app can fix." : "Narrow it with `Ui.Within(<container or row>) { \u2026 }`.";
        const inFull = exactly ? "" : ` Or ask for one of them in full: ${matches.map((el) => `"${fieldNameOf(el)}"`).join(" \xB7 ")}.`;
        throw new Error(
          `'${label}' matches ${matches.length} different fields by ${tier}, so which one was meant is ambiguous:
${describeCandidates(matches)}
` + narrowingAdvice(matches, fallback) + inFull + " (Refused rather than picking one: the choice would be an accident of the order they happen to render in.)" + SCOPING_DOC
        );
      };
      const exact = inputs.filter((el) => accessibleName(el) === label);
      if (exact.length) return pick(exact, "name", { exactly: true });
      const byAria = inputs.filter((el) => accessibleName(el).includes(label));
      if (byAria.length) return pick(byAria, "part of their name");
      const byPlaceholder = inputs.filter((el) => (el.getAttribute("placeholder") ?? "").includes(label));
      if (byPlaceholder.length) return pick(byPlaceholder, "part of their placeholder");
      const byName = inputs.filter((el) => (el.getAttribute("name") ?? "").includes(label));
      if (byName.length) return pick(byName, "part of their member name");
      return null;
    }
    function fieldNames() {
      return fields().map(fieldNameOf);
    }
    function namedNonFields(label) {
      const pool = candidates().filter((el) => !isFieldElement(el));
      const exact = pool.filter((el) => accessibleName(el) === label);
      const hits = exact.length > 0 ? exact : pool.filter((el) => accessibleName(el).includes(label));
      return [...new Set(disjointDeepest(hits).map(clickableFor))];
    }
    function describeNamedNonFields(label) {
      const hits = namedNonFields(label);
      if (hits.length === 0) return "";
      return `
'${label}' IS on this screen \u2014 it is just not one of those inputs:
${describeCandidates(hits)}
So this is not "there is nothing called that": it is something you cannot type into. ${howToDriveThese(label, hits)}`;
    }
    function opensSomething(el) {
      return el?.getAttribute?.("aria-expanded") !== null || el?.getAttribute?.("aria-haspopup") !== null || el?.getAttribute?.("role") === "combobox" || el?.getAttribute?.("role") === "listbox";
    }
    function howToDriveThese(label, hits) {
      const opens = hits.filter(opensSomething);
      if (opens.length > 0) {
        return "Drive it the way it is actually operated \u2014 `Ui.Click` opens a picker or a menu, `Ui.Select` chooses within one.";
      }
      const presses = hits.filter((el) => clickTargetOf(el));
      if (presses.length > 0) {
        return `Nothing here OPENS, though: what answers to '${label}' is a plain pressable (no \`aria-expanded\`), so \`Ui.Click\` ACTUATES it and there is nothing for \`Ui.Select\` to choose within. If a value was meant to be typed here, no control on this page renders an input for '${label}' \u2014 that is a fact about the PAGE, and the field is what is missing.`;
      }
      return `And it is not a control at all \u2014 what answers to '${label}' is text, with no click target and nothing to open, so \`Ui.Click\` and \`Ui.Select\` have nothing to act on either. The words are on screen and the FIELD they name is not: this is a fact about the PAGE, not about the locator.`;
    }
    function screenNote() {
      try {
        if (!env.document) return null;
        const route = currentRoute();
        const seen = reachableTexts().slice(0, 20);
        return `${route ? `The browser is on '${route}'. ` : ""}What a person can read right now: ${seen.join(" \xB7 ") || "(nothing \u2014 this screen rendered no text at all, so the render itself is what to look at)"}`;
      } catch {
        return null;
      }
    }
    function currentRoute() {
      try {
        const routed = env.route;
        if (typeof routed === "string" && routed !== "") return routed;
      } catch {
      }
      try {
        return env.document?.location?.pathname || null;
      } catch {
        return null;
      }
    }
    function nothingReachableToOffer(label) {
      const screen = screenNote();
      return `
There are no inputs here AT ALL, and nothing else on this screen answers to '${label}' either \u2014 so this is a fact about the PAGE, not about the locator. ` + (screen ?? "What a person can read right now: (no page is open \u2014 nothing has been visited yet)");
    }
    function noOptionRefusal(label, item, offered, enumType) {
      const looksLikeEnum = offered.length > 0 && offered.every((v) => /^\d+$/.test(v));
      const askedIsWord = !/^\d+$/.test(String(item));
      return `no option with identity '${item}'${label ? ` in '${label}'` : ""}. ` + (looksLikeEnum && askedIsWord ? `These options are an ENUM \u2014 each is stamped with its member's position (${offered.join(" \xB7 ")}), not its name. Pass the MEMBER rather than the text: \`Ui.Select(${label ? `"${label}"` : "\u2026"}, ${enumType || "<TheEnum>"}.${item})\`.` : offered.length ? `The options on screen are: ${offered.join(" \xB7 ")}` : nothingCarriesAnIdentity());
    }
    function nothingCarriesAnIdentity() {
      const screen = screenNote();
      const causes = "either the control did not open, or its options are not rendered by a `foreach` (only a foreach row is stamped).";
      if (screen === null) return `Nothing on screen carries a row identity at all \u2014 ${causes}`;
      return `Nothing on screen carries a row identity at all \u2014 so this is a fact about the PAGE, not about the locator. ${screen}
If that is not the screen this test meant to be on, THAT is the whole finding: the options are missing because the page is (signing a test in by calling the app's own login FUNCTION leaves the browser where it was \u2014 \`Ui.SignInAs\` is what signs the BROWSER in). If it IS the right screen, then ` + causes;
    }
    function noFieldRefusal(label) {
      const inputs = fieldNames();
      const named = describeNamedNonFields(label);
      return `no input matching '${label}'. Inputs currently reachable: ${inputs.join(" \xB7 ") || "(none)"}${scopeNote()}` + named + (inputs.length === 0 && named === "" ? nothingReachableToOffer(label) : "");
    }
    function parsePickerValue(text) {
      const s = String(text).trim();
      let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, hour: null, minute: null };
      m = /^(\d{1,2}):(\d{2})$/.exec(s);
      if (m) return { iso: null, hour: Number(m[1]), minute: Number(m[2]) };
      m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(s);
      if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, hour: Number(m[4]), minute: Number(m[5]) };
      return null;
    }
    function comboTriggerFor(label) {
      const named = findByAriaLabel(label, { exact: true, prefer: clickable });
      if (!named) return null;
      const target = clickableFor(named);
      return target?.getAttribute?.("aria-expanded") === null ? null : target;
    }
    function comboScopeOf(trigger) {
      if (!trigger?.parentElement) return null;
      for (let p = trigger.parentElement; p; p = p.parentElement) {
        if (p.querySelector?.('[role="listbox"]') || p.querySelector?.('[role="dialog"]')) return p;
      }
      return null;
    }
    function datesOn(scope) {
      return [...new Set([...scope.querySelectorAll("[data-osy-item]")].map((el) => el.getAttribute("data-osy-item")).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)))].sort();
    }
    function comboKindOf(scope) {
      if (scope === null) return "unknown";
      if (scope.querySelector('[role="listbox"]')) return "dropdown";
      const hasDays = datesOn(scope).length > 0;
      const hasTime = scope.querySelector('[aria-label^="hh "], [aria-label^="mm "], [aria-label="Change the time"]') !== null;
      if (hasDays && hasTime) return "datetime";
      if (hasDays) return "date";
      if (hasTime) return "time";
      return "unknown";
    }
    return {
      scopeRoot,
      resolveWithin,
      liftOffALeaf,
      looksLikeRowIdentity,
      rowIdentityNotOnScreen,
      textElementsReading,
      scopeIsTextNotAContainer,
      scopableNames,
      dialogNameOf,
      withinBaseDescription,
      openDialogName,
      vanishedNote,
      vanishedEarlierNote,
      recordInteraction,
      interactionResolved,
      scopeNote,
      readableTexts,
      reachableTexts,
      textRoot,
      chromeOutsideApp,
      collapse,
      canonicalProbeValue,
      candidates,
      mimeFor,
      accessibleName,
      keyCodeFor,
      disjointDeepest,
      rowName,
      renderedRows,
      rowsNamed,
      enclosingScopeOf,
      enclosingItemOf,
      isFieldElement,
      fieldNameOf,
      narrowingAdvice,
      describeCandidates,
      describeOneCandidate,
      describedTagOf,
      withRole,
      candidateCoordinate,
      coordinateRoot,
      isClickable,
      byText,
      findByAriaLabel,
      depth,
      clickableFor,
      clickable,
      clickTargetOf,
      fields,
      fieldFor,
      fieldNames,
      namedNonFields,
      describeNamedNonFields,
      opensSomething,
      howToDriveThese,
      nothingReachableToOffer,
      noOptionRefusal,
      noFieldRefusal,
      parsePickerValue,
      comboTriggerFor,
      comboScopeOf,
      datesOn,
      comboKindOf,
      // Handed out through the factory as well as at module scope, so a consumer that took the factory has the WHOLE
      // vocabulary from one object rather than two — `ui-verbs.mjs` reads its page's text through this.
      renderedTextsIn,
      /** The `within:` path as the driver's own verbs need to read and set it — the one piece of this module's state
       *  that belongs to a COMMAND rather than to a locator, so it is reached through the door rather than shared. */
      getWithinScope: () => withinScope,
      setWithinScope: (v) => {
        withinScope = v;
      },
      /** A fresh page owes nothing to the previous one's last action. */
      forgetInteractions: () => {
        lastInteraction = null;
        stagedInteraction = null;
        interactionHistory.length = 0;
      }
    };
  }
  return __toCommonJS(ui_dom_exports);
})();
globalThis.OsyUiDom = OsyUiDom;
