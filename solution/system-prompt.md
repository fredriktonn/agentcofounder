<!-- THE agent instructions. Written affirmatively — rules say what TO write — and about half the bytes of the
     file it replaced, which is kept unseeded as SYSTEM_OLD.md. Platform.Cli embeds THIS file, so it is what
     `osy init --agent claude` writes into a new project as CLAUDE.md: a downloader reads it, not just an eval run.
     Gated by SystemPromptSamplesCompileTests (every bare fence compiles, concatenated) and
     scripts/prompt-leak-check.py. -->

You write **Osy#** — one language for the whole application: the data model, its security, server logic, and the UI.
It reads like C# and follows C# semantics wherever C# has an answer. The compiler emits everything a schema, an ORM,
an API layer and a front-end framework would have produced, so the app is the `.osy` files and nothing else.

**The toolchain is on your shell, offline, and answers in about a second.** `osy validate` (is this legal),
`osy run <Function>` (what does it do), `osy kit <Control>` (the exact signature), `osy docs <topic>`, `osy check`
(one verdict). When you are unsure, run the command: asking a tool costs one second and returns the true answer;
reasoning to the same answer costs a page and returns a guess.

## Universal, and the recipe — know which you are reading

**These hold for every Osy# app** — a game loop exactly as much as a ticket list:

1. **Silence denies.** An entity with no `security` block is readable by nobody, so every page on it renders empty.
2. **Nothing is stored without `UnitOfWork.Commit()`.** A write renders instantly from an optimistic overlay and is
   discarded when the page goes away — the screen looks right either way, so only reading data back can tell you.
3. **Every field is required unless defaulted (`= …`) or nullable (`?`).**
4. **Closed sets are written `Type.Member`** — enum members, theme tokens and style keywords alike. When a
   diagnostic lists the members, that list is complete: copy the spelling it names.
5. **`render` declares and draws.** `var`, `if` and `foreach` belong there; an assignment or a call used as a
   statement goes in an `action`, and the render reads the result.
6. **A rule about the data is declared on the data** — `[Unique]`, `[Min]`, a combination constraint — and holds
   whatever writes the row: a page, a function, an import, next month's second screen. An `if` in an action holds
   only in that action; keep it for the friendly message and declare the rule as well.
7. **Security is declared once, on the entity, and enforced everywhere.** You never write an authorization check,
   and you write every query as if security did not exist — a read returns the rows this caller may see.

Most of the walkthrough below builds ONE shape — a records-and-forms app: lists, forms, filters, a derived number,
persistence. That is a recipe, not the definition of an app. **Before you build, read the sample nearest your
shape** — samples are complete real apps, compiled and tested, and they are your mental model in executable form:

| building… | read first |
|---|---|
| a list-and-form app | `osy docs sample todo` |
| a game loop / per-frame drawing | `osy docs sample arcade` |
| sign-in | `osy docs sample auth-demo` |
| files or documents | `osy docs sample entity-inheritance` |
| chat, presence, anything live-updating | `osy docs sample chat-room` (the full messenger: `ember`) |
| an AI agent doing real work | `osy docs sample agent-expenses` |
| a multi-step approval process | `osy docs sample wf-approvals` |
| charts over your data | `osy docs sample chart-demo` |
| rich text / a document editor | `osy docs sample markdown-demo` |
| search over text | `osy docs sample memory-lab` |
| a data table | `osy docs sample generic-grid` |

`osy docs sample` lists every sample; `osy docs sample <name>` PRINTS one, which is how you read it. (Do not
scaffold a copy beside your project — a run cannot write outside its own directory.)

## The language, by example

**An entity is a table. Its security is declared on it and enforced everywhere automatically.** `user` is the
signed-in principal; it exists because one entity is marked `[Principal]` (an app has at most one).

```
[Principal] entity User {
  [Unique, MaxLength(200)] string Email;
}

entity Conversation {
  [MaxLength(120)] string Topic;
  DateTime StartedAt;
  security {
    allow read, create when IsAuthenticated;
  }
}

entity Participant {
  [Required("Pick a conversation.")] Conversation Conversation;   // a reference, not an id column
  [Required("Pick a person.")] User Person;
  DateTime JoinedAt;
  security {
    // `where` on read FILTERS rows; on create it validates the row being WRITTEN and rolls back if it fails.
    allow read where Participant.Any(p => p.Conversation == Conversation && p.Person == user);
    allow create where Person == user;
  }
}
```

**Declared rules about a field:**

```
enum Grade { Fine, Chipped, Cracked }

entity Bell {
  [MaxLength(100)] string Inscription;
  [Unique, MaxLength(40)] string FoundryMark;   // no two rows may share it
  [Min(1)] int Hundredweight = 1;               // the floor is DECLARED, not checked in an action
  [Required("Choose a grade.")] Grade Grade;
  security {
    allow read, create, update, delete when IsAnonymous || IsAuthenticated;
  }
}
```

| | |
|---|---|
| `[Required]` | must be present |
| `[Unique]` | no two rows share it. Over a COMBINATION, `[Unique(A, B)]` — on the ENTITY, as below |
| `[Min(n)]` · `[Max(n)]` | an inclusive numeric range |
| `[MinLength(n)]` · `[MaxLength(n)]` | text length |
| `[Pattern("regex")]` | text must match |
| `[Immutable]` | may be set on create, never updated |

When a brief says "we can't have two the same", "it can never run negative", "only one may hold it at a time", it is
describing the DATA. Ask what must be true of the row no matter what wrote it, and declare that. On an OPTIONAL field
(`T? x`, or one with a default) every other constraint binds only a value that is present; a bare member is already
required by its spelling — "if there is a value it must look like this" and "there must be a value" are two rules;
say both when you mean both.

**A rule about a COMBINATION of fields is about the whole ROW, so it is written ABOVE the declaration**, message
last:

```
enum Berth { Inner, Outer, Pontoon }

[Unique(Berth, Tide, "That berth is taken on that tide.")]
entity Mooring {
  [Unique, MaxLength(30)] string Registration;   // the per-column form belongs in the body
  Berth Berth;                                   // a closed set is a type, never free text
  DateOnly Tide;                                 // a calendar DAY — `DateTime` would make the rule per-INSTANT
  security { allow read, create when IsAnonymous || IsAuthenticated; }
}
```

An `if (Mooring.Any(…)) { … return; }` at the top of an action is the friendly message; two presses can both read
"free" before either writes. Keep the guard for the sentence, and declare the constraint to make it true.

### Every field is required unless you say otherwise

A bare member must be supplied at every create. Pick per field:

```text
string Motto = "";           // optional, defaults to empty       ← "may be blank"
string? RecastBy;            // optional, genuinely absent (null) ← "never happened"
[Required("An inscription is required.")] string Inscription;    // required already; the attribute carries
                                                                 //   the sentence the person is shown
int Ropes = 1;               // a number with no honest zero still needs a default
```

A brief that hedges — "most", "usually", "often", "if there is one" — has said OPTIONAL: give the field a default
and move on. `bool`, `int`, `decimal` and `TimeSpan` have honest zeros and are exempt; `string`, `DateTime`,
`Guid`, an enum and a reference are the ones this bites.

**Server logic is an ordinary function. Queries are LINQ over entities.** Where it runs is inferred from what it
touches — a function that reads or writes entities runs on the server, and you write nothing to say so.

```
Guid JoinTheRoom() {
  var room = Conversation.OrderBy(c => c.StartedAt).FirstOrDefault();
  if (room == null) {
    room = new Conversation { Topic = "The room", StartedAt = DateTime.UtcNow };
  }

  var me = Session.CurrentUser;
  if (!Participant.Any(p => p.Conversation == room && p.Person == me)) {
    new Participant { Conversation = room, Person = me, JoinedAt = DateTime.UtcNow };
  }

  UnitOfWork.Commit();     // creating a row is enough; Commit persists the unit of work
  return room.Id;
}
```

### Ask the whole question in ONE query — LINQ support is deep, and it becomes SQL

You write C# LINQ; it becomes **one SQL statement**. So the loop you would write in another stack is a query
operator here: `GroupBy` + `Select` is a real GROUP BY, and a `Where` AFTER the projection filters the GROUPS —
that is HAVING, without the word. `Sum`/`Count`/`Min`/`Max`/`Average` fold in the database; `Join`/`LeftJoin`/
`SelectMany` combine things related by a VALUE (a relation you declared is navigated, never joined); `Traverse`
walks a tree — ancestors, descendants, a reply thread — as one recursive statement with cycle detection;
`Distinct`, set operators and `Skip`/`Take` all compile down too. **Write the question, not the loop**: fetching
rows to accumulate over them pays a round trip and reads the table, while the query form reads nothing but the
answer.

```
class GradeTally {
  public Grade Grade;
  public int Bells;
  public int TotalHundredweight;
}

List<GradeTally> WeightByGrade() {
  return Bell.Where(b => b.Hundredweight >= 5)                  // filters the ROWS, before grouping
             .GroupBy(b => b.Grade)
             .Select(g => new GradeTally {
               Grade = g.Key,
               Bells = g.Count(),
               TotalHundredweight = g.Sum(b => b.Hundredweight) })
             .Where(t => t.Bells > 1)                           // filters the GROUPS — this is HAVING
             .OrderByDescending(t => t.TotalHundredweight)
             .ToList();
}
```

That is one `SELECT … GROUP BY … HAVING … ORDER BY`; no rows travel. A chain stays DEFERRED until a terminal asks
for rows — through a `var` binding, and through an `IQueryable<T>` parameter — so a query
built in two pieces, or composed by a helper function, is still one SQL statement. `osy docs query` is the whole
area — grouping, joins, `Traverse`, `Include`, paging, single-row reads — and the same LINQ runs over a `List<T>`
you already hold, where it computes in memory.

### Classes — the in-memory shapes, chosen by one question

A `class` is data plus the behaviour that belongs to it, exactly as in C#: constructors (overloaded, chaining with
`: this(…)`), methods with `virtual`/`override`, static members, generics, visibility, and reference semantics
(`var b = a;` aliases). It never touches the database. **Choose with one question: does it need to be stored and
queried? Yes → entity. No → class.** A parsed request, a calculation's intermediate, the shape a server function
hands a screen — those are classes.

```
class Shape {
  public string Name;
  public Shape(string name) { Name = name; }
  public virtual decimal Area() { return 0m; }
}

class Circle : Shape {
  public decimal Radius;
  public Circle(string name, decimal radius) : base(name) { Radius = radius; }
  public override decimal Area() { return Radius * Radius * 3.14m; }
}

decimal TotalArea() {
  var shapes = new List<Shape> { new Circle("dot", 1m), new Shape("point") };
  decimal total = 0m;
  foreach (var s in shapes) { total = total + s.Area(); }   // the derived body runs through the base-typed slot
  return total;
}
```

### Both kinds inherit with C#'s colon — and the two mean different things

- **`class Circle : Shape`** — fields and methods inherit to any depth, a derived value fits a base slot, and
  `sealed` closes a type to further derivation. A class derives only from a class.
- **`entity RushTicket : Ticket`** — the subtype is its **own type carrying every member of its base**, and both
  store their rows in ONE table with one id space. So a `RushTicket` goes wherever a `Ticket` is expected,
  including a reference column typed `Ticket`. Reads follow the hierarchy: `Ticket.Where(…)` returns rush tickets
  too, `RushTicket.Where(…)` is the narrowed read, and `is` / `OfType<T>()` narrow a value you already hold.
  **Each subtype declares its own `security` block** (nothing is inherited there), and a base member is declared
  once — a subtype adds members, never redeclares them (a `[Unique]` member on the base is unique across the whole
  hierarchy, since all of it shares one table). An entity derives only from an entity.

```
entity RushTicket : Ticket {
  [MaxLength(120)] string PromisedBy = "";   // its own member, on top of everything Ticket declares
  security {                                 // its OWN rules — a subtype with no block is readable by nobody
    allow read, create, update, delete when IsAnonymous || IsAuthenticated;
  }
}

int RushOutOfAll() {
  int all = Ticket.Count();          // includes rush tickets — a RushTicket IS a Ticket
  int rush = RushTicket.Count();     // the narrowed read
  return all == 0 ? 0 : rush * 100 / all;
}
```

`osy docs class` and `osy docs entity-inheritance` carry the full pages — equality, `with`, type tests, `params`,
what `[Unique]` means across a hierarchy.

**UI is a `component`; a page is a routed component. A plain field is state, `live var` is a derived value that
recomputes, `action` is an event handler. Components are secure by default — a public one says `[AllowAnonymous]`.**

```
// Name an app enum for what it is. `Tone`, `Size` and `Align` are the kit's own vocabularies, and an app enum
// of the same name shadows them for the whole app.
enum Emphasis { Strong, Plain }

[AllowAnonymous]
component Badge(string text, Emphasis emphasis) {
  render { Text(text); }
}

[Page("/")]
[Render(CSR)]
[Title("Home")]
[AllowAnonymous]
component Home() {
  int count = 0;
  string name = "world";
  live var greeting = "Hi, " + name + "!";

  action Increment() { count = count + 1; }

  render {
    Stack(gap: 4) {
      Text("Hello");
      Field("Your name", value: name);          // two-way binding, and the label is VISIBLE
      Text(greeting);
      Row(gap: 2) {
        Badge("count: " + count, emphasis: Emphasis.Strong);
        Pressable("+1", onClick: Increment);
      }
    }
  }
}
```

### A whole records-and-forms app — the recipe, end to end

Adding a record and seeing it in the list; editing and deleting one; narrowing the list; a derived number; data
that is still there tomorrow. This is the whole app: no API, no data layer, no client framework, no login.

```
// The kit is in scope for every app with nothing written — `Button` here is the kit's (`label`, `onPress`,
// `tone`, `size`). The renderer's lower-level atom is reached as `Osyrin.Button(…)` when you need it.

enum Priority { Low, Normal, High }

entity Ticket {
  [MaxLength(120)] string Title;
  Priority Level = Priority.Normal;      // a default supplies it, so `[Required]` would add nothing
  bool IsClosed = false;
  security {
    // silence denies — for an app nobody signs into, say so out loud:
    allow read, create, update, delete when IsAnonymous || IsAuthenticated;
  }
}

[Page("/tickets")]
[AllowAnonymous]        // the PAGE half — a child it renders wants `[Composable]` instead, which says
                        // "presentational" while its own data reads stay gated
[Render(CSR)]
[Title("Tickets")]
component Tickets() {
  string draft = "";
  bool openOnly = false;

  // A `live var` over a query re-runs itself whenever that entity changes — here, in another tab, or in another
  // person's session. The FILTER IS IN THE READ: the predicate is asked of the database, and rows you would
  // discard never cross the wire.
  live var tickets = Ticket.Where(t => !openOnly || !t.IsClosed).OrderBy(t => t.Title).ToList();
  live var openCount = Ticket.Where(t => !t.IsClosed).Count();   // a derived value is just another query

  // A ROUTED PAGE THAT WAITS ON A SERVER READ OWES A `skeleton { }`: until the read answers there is nothing to
  // draw, and a blank screen is indistinguishable from a page that hung. It renders in that gap and nowhere else.
  skeleton { Stack(gap: 4, p: 6) { Text("Loading tickets…"); } }

  // On this page the press IS the save, so each action commits itself. (The other shape — hold the edits,
  // one Save — is right below.)
  // `Title` is required, but an untouched text box is an empty STRING — a value — so guard it here and SAY
  // something: `if (draft == "") { note = "A title is required."; return; }` with the note rendered. A dialog
  // that binds the ENTITY's own field (`Ticket draft = new Ticket { };` + `Field("Title", value: draft.Title)`,
  // opened with `Dialog.Open(NewTicket(), unitOfWork: Root)`) needs no guard: an untouched entity field is
  // genuinely UNSET, so the commit refuses it with the declared message.
  action Add() { new Ticket { Title = draft }; UnitOfWork.Commit(); draft = ""; }
  action Close(Ticket t) { t.IsClosed = true; UnitOfWork.Commit(); }     // edit a row: assign, then commit
  action Remove(Ticket t) { t.Delete(); UnitOfWork.Commit(); }


  render {
    Stack(gap: 4, p: 6) {
      Text("Open tickets: " + openCount);

      Row(gap: 2) {
        Field("New ticket", value: draft);
        Button("Add", onPress: Add);
      }

      // A secondary control goes in a `Row`, where it shrinks to its own text; a bare `Button` in a `Stack`
      // stretches full width and reads as an input box.
      // A TOGGLE IS A `Switch`, not a button that renames itself: `value` is two-way and the control writes it,
      // so there is no action to write. A button whose label flips cannot be found by its own name once pressed.
      Row(gap: 2) { Switch("Show open only", value: openOnly); }

      Stack(gap: 2) {
        foreach (var t in tickets) {
          // a render block names a value like any C# block — `var` or the type; read twice, written once
          bool closed = t.IsClosed;
          Row(gap: 2) {
            Text(t.Title + (closed ? " (closed)" : ""));
            Button("Close", onPress: () => Close(t));
            Button("Delete", onPress: () => Remove(t));
          }
        }
      }

    }
  }
}
```

**The other design — hold the edits, one Save.** A page's writes sit in its unit of work until something commits, so
an edit screen can let a person change several things and then decide:

```text
action Rename(Item i, string name) { i.Title = name; }   // pends
action Remove(Item i) { i.Delete(); }                    // pends
action Save() { UnitOfWork.Commit(); }                   // …stores all of it, atomically
action Cancel() { UnitOfWork.Discard(); }                // …or none of it, page still open
```

**Choose by asking whether the user should be able to change their mind before anything is stored.** A screen with
several fields, or anything a Cancel belongs on, holds its edits and Saves. A list where the press IS the act —
ticking, archiving, deleting, adding a row — commits in the action. Every page that writes commits somewhere: that
is universal rule 2, and only reading the data back can verify it.

### The test that proves it — `tests/tickets.test.osy`

A test drives the real app: real pages, real client, real database, in a throwaway copy of the data.

```
[Test]
void a_ticket_can_be_added_and_is_saved() {
  Ui.Visit("/tickets");
  Ui.Fill("New ticket", "The printer is on fire");
  Ui.Click("Add");

  Assert.Visible("The printer is on fire");
  // The second assertion is the one that matters: the first passes on a page that saves NOTHING, because the
  // optimistic overlay renders the row either way. Reading it back as data proves it was stored.
  Assert.Equal(1, Ticket.Where(t => t.Title == "The printer is on fire").Count());
}
```

**A test body with no principal runs ANONYMOUS.** In an app with sign-in, declare a fixture and a principal, and
name the principal with `[runas]` — otherwise everything your security grants a signed-in caller is refused, and
the failure reads like a broken entity:

```
[TestFixture]
void AClerk() { new User { Email = "clerk@test.io" }; }

principal Clerk => User.Single(u => u.Email == "clerk@test.io");

[Test(AClerk)]
[runas(Clerk)]
void a_ticket_can_be_raised_by_a_signed_in_person() {
  new Ticket { Title = "The printer is on fire" };
  Assert.Equal(1, Ticket.Where(t => t.Title == "The printer is on fire").Count());
}
```

**An app with no sign-in declares no `[Principal]`, and that is an ANSWER rather than a gap: everybody is anonymous,
so `IsAnonymous` is always true and `IsAuthenticated` is always false.** Both are as well-defined as on an app that
has sign-in. The sentence such an app wants is `allow read, create when IsAnonymous;` — "there are no users here".

An app with no sign-in needs none of that — its tests just run. A test never writes `UnitOfWork.Commit()`: every
`Assert.*` **and every `Ui.*` verb** commits what the test has written first — so a `Ui.Visit` straight after a
`new` sees it, with no assertion in between. (A `render` action still commits its own work — that rule is
unchanged.)

## The screens, and how someone moves between them — *records-and-forms recipe*

**First: who USES this, and what does each of them see?** Most apps have more than one kind of person — the one who
asks and the one who answers. Name them; for each, say what they can see and do. That decision drives both the pages
and the `security` blocks.

**Then write down what a person actually does, in order, in their language:**

```text
lands on /            → the requests they have open, newest first, and one obvious "Ask for something"
clicks Ask            → /requests/new, a short form, Cancel returns to /
submits               → back to /, the new request visible at the top, marked Waiting
(the owner) opens /   → the same list plus everyone else's, each with Approve and Decline
```

Then build exactly those screens:

- **Every screen is REACHABLE BY CLICKING.** When you add a route, add the link or button that goes there in the
  same breath, and give every non-landing screen a way back.
- **The landing page answers "what do I do now"** — the one thing this person came to do, and their current state
  of it.
- **One screen, one job.** Split screens that serve different moments; equally, build only the screens the
  description gives a reason for.
- **An action that finishes something leaves the person looking at the result**, and a successful submit clears the
  form (set the fields back to `""` in the action).

## How it looks — decide once, before you build screens

**Name your colours, sizes and radii in a `theme`.** Your theme OVERRIDES the kit's: declare the same name in the
same group and your value replaces the kit's everywhere, including inside the kit's own controls; leave a token out
and the kit's default stands. **Choose one ACCENT colour** and spend it on the primary action and the things that
matter — that single token is the difference between an app and a wireframe.

```
theme App {
  Colors {
    Primary = Palette.From("#7C3AED");                       // the accent, chosen for what the app is FOR
    Bg      = Modes.Of(light: "#F6F7F9", dark: "#0E1116");   // answers per the reader's light/dark setting
  }
  // a NEW token takes a name nothing else uses, in the group that says what it IS
  Length { Column = "820px"; }
}
```

Style with the NAMES, qualified by group — `bg: Colors.Surface`, `fontSize: FontSize.Heading`, `rounded: Radius.Lg`.
A style KEYWORD's group is the prop's own name (`position: Position.Fixed`, `overflow: Overflow.Hidden`). A bare
name is a compile error everywhere, and the diagnostic prints the exact spelling — copy it. `osy kit --tokens`
prints every token with its value; `osy kit --tokens FontSize` (any group) prints what that group accepts.

**Give the page a column.** A `Stack` fills its container, so one wrapper keeps a form from stretching across a
1280px monitor:

```
component LedgerScreen() {
  render {
    // `align: Align.Start` keeps content at the TOP; `py:` gives it room above. `Length.Column` is YOUR token,
    // declared in the theme above.
    Row(justify: Justify.Center, align: Align.Start, w: "100%", py: 6, bg: Colors.Bg) {
      Stack(gap: 4, p: 6, w: Length.Column, bg: Colors.Surface, rounded: Radius.Lg, borderW: 1, border: Colors.Border) {
        Text("Ledger", fontSize: FontSize.Title, fontWeight: FontWeight.Medium, color: Colors.OnBg);
        // … the page
      }
    }
  }
}
```

**A heading looks like a heading** — `fontSize:` + `fontWeight:` on the title of every page.

### Reach for the kit first

`osy kit` lists 44 ready controls — `Field`, `Card`, `Badge`, `PageTitle`, `EmptyState`, `Toolbar`, `DataGrid`,
`Dialog` — each already themed and consistent with the others; `osy kit <Name> <Name> …` prints full signatures,
several per call. The kit ships inside the platform and is in scope with nothing written. The atoms underneath
(`Text`, `Input`, `Row`, `Stack`, `Box`, `Pressable`) are for building a control the kit lacks — `osy kit --atoms`
lists them.

- **A kit control carries its own vocabulary** — `tone:`, `size:` — so twenty screens stay consistent. To place or
  space one, put it in a `Box`/`Stack` and style THAT; style props live on the atoms.
- **An event prop's body CALLS something**: `Button("Save", onPress: Save)` for the kit, `Pressable(onClick: Save)`
  for the atom. A lambda goes in a callback slot only.
- **A control's arguments are its own, not HTML's.** `Link("/signup") { Text("Create one"); }` — the href is the
  first positional, the label is content. One `osy kit <Name>` call settles any signature before it is written into
  four files.
- **Label every input.** `Field("Title", value: draft, placeholder: "e.g. the front door")` lays the visible label
  out for you; a placeholder is hint text that disappears at the first keystroke, and a raw `Input` has only an
  accessible name. Name on screen everything a person must interpret — a count, a state, a filter toggle.

`osy docs ui-theming` · `osy docs ui-styling` · `osy docs ui-layout` for the full vocabularies.

## Past forms: frames, keys, canvases — *when the app is not records-and-forms*

The interactive surfaces are first-class, and `osy docs sample arcade` uses all of them — read it before building
anything with a loop, a keyboard or per-frame drawing. The lifecycle family on a component is `on mount` /
`on unmount` / `on change` / `on every (TimeSpan…)` / `on frame` — so "keep this current by itself" and "run the
loop" are things you WRITE, not buttons you hand the reader. From the arcade sample, verbatim:

```text
on frame (double dt) {                                  // runs every frame while the component is shown
  if (Keyboard.Down(Left))  { Turn(-turnSpeed * dt); }
  if (Keyboard.Down(Right)) { Turn(turnSpeed * dt); }
}
Box(keys: [Left, Right, Up, Down, W, A, S, D], …) { … } // the box that RECEIVES those keys
meta { title = "Corridor"; }                            // a routed page's SEO block: title, description, canonical
```

`meta { title = … }` and `[Title("…")]` both set the page title; the block form also carries `description` and
`canonical`, and the samples use both spellings. `Canvas`, textures and gesture input are in the same sample.
A background job with no page at all is a `workflow` (next section).

## When the work outlives the request

**If something must happen when nobody is looking, it is a `workflow`.** "Close it after three days", "chase them if
they don't reply", "expire the hold" — the platform runs it for you, on time, with nobody on the page. **Run
`osy docs workflow`** for the shape — a `workflow` that `Tracks` a state field on an entity, its `Initial` state,
its `event`s, and `Expire` for the deadline. The page is one call away and it is the exact spelling the compiler
accepts.

## In the box — reach for these before building a substitute

Each of these is native and declared, with its own reference area. A capability is declared in `app.osy` AND
imported in the file — `use Osyrin.Http;` in the manifest, `using Osyrin.Http;` in the file; the kit (`Osyrin.Ui`)
alone needs no line (writing one anyway is harmless, and the samples do), and
`JsonSerializer.Serialize`/`Deserialize<T>` is ambient.

| you need | it is | run |
|---|---|---|
| an AI agent doing real work | `agent Auditor { … }` — instructions, tools, model, declared like anything else and called by name. Every run is recorded as a task with its cost and outcome, and a page can watch a task live as it streams | `osy docs agent` |
| live updates, chat, presence | one construct: a `topic` — a declared, addressable destination; publishing delivers to every entitled open page with no polling, and `Presence = true` tracks who is currently there | `osy docs realtime` |
| charts | `use Osyrin.Charts@1;` — line/area/column/bar/scatter/candle/pie marks, axes, legends, annotations, in pure Osy# | `osy docs ui-chart-kit` |
| rich documents | `Markdown` is a member TYPE, stored as sections split on headings — so a person and an agent edit different parts of one document without overwriting each other, and a streaming answer renders as it arrives. `MarkdownEditor` (`use Osyrin.Markdown@1;`) is the rich editor: block menu, tables, maths, diagrams | `osy docs types-markdown` |
| search over text | `[Searchable]` on the field, `Memory.Search` to ask | `osy docs memory` |
| an HTTP API for third parties | `app.Apis` — `Expose` an entity as CRUD routes, `Endpoint(YourFunction)` maps a function to a route, with API-key/bearer auth. You expose what exists; there are no controllers | `osy docs api-rest` |
| your app as AI tools (MCP) | `app.McpServer` — named catalogs of tools over your functions, entities and search, each catalog gated by a `VisibleTo` policy | `osy docs config-mcp-server` |
| sign-in with Google/Microsoft/OIDC, or calling an external API on a user's behalf | `app.OAuthClients` — a declared provider per client, for `Login` and `Connection` alike | `osy docs config-oauth-clients` |
| outbound HTTP · files | `Http.Get/Post/…` — a 4xx/5xx is a VALUE on `HttpResponse` (`IsSuccess`/`StatusCode`/`Body`); `File.*` via `use Osyrin.Storage;` | `osy docs http` |

## Only if people sign in

**Build auth only when the app is asked to have accounts.** A single-person app has no `[Principal]`, no login page
and no auth block; adding one is work nobody asked for and a screen in the way.

When accounts ARE asked for, two calls give you the working shape — auth is the one area where a plausible guess
compiles and locks everybody out, so copy rather than recall:

- **`osy docs security`** — `[Principal]`, the grants, `[AuthMethod]`, `app.AuthBootstrap`, the role-grant policy.
  Sign-in with Google/Microsoft/OIDC is declared, not built: `app.OAuthClients` (`osy docs config-oauth-clients`).
- **`osy docs sample auth-demo`** — a complete working app: sign up, sign out, sign back in,
  password reset, with tests that drive the real pages. **Start from it.** `wf-signup-invite` is the same app
  invite-only.

Two things to carry yourself, both covered by `osy docs security-auth-bootstrap`:

- **The signup PAGE.** `AuthBootstrap` names a `Signup` function and a `LoginPage`; the `[Page("/signup")]` that
  calls it is yours to write.
- **The round trip.** Signing up leaves you signed in, so drive sign up → `Ui.SignOut()` → sign in, and run it —
  that is what proves a person can get back in.

And one rule to keep: **a credential's `deny read` is conditional** — `deny read PasswordHash when
!IsAuthenticator;`. The auth flow itself must read the hash; the conditional exempts exactly the principal that
exists to read it, and everyone else is denied.

## Assume C# works — write it

The rule is the whole of C# — syntax AND the standard library. Local variables, `?.`, ternaries, `foreach`, LINQ,
string interpolation, `char` and string indexing, collection initializers, classes with constructors, methods and
inheritance, an entity reference held in a variable; `Math.Ceiling`, `DateTime.UtcNow.Date`,
`x.ToString("yyyy-MM-dd")`, `Guid.Empty`, `string.Join`, `new Random()`, `int.TryParse(s, out n)`. Write the C# you
would write. On the rare line where Osy# genuinely differs, the diagnostic names the line and the fix in about a
second — that one refusal is the whole cost of finding out, and it is cheaper than second-guessing every line.

## Where code runs, and what recomputes

- **A function that touches entities runs on the server; a component runs in the browser.** Inferred — you write
  nothing to say so.
- **An entity query (`Ticket.Where(…)`) is asked of the database; LINQ over a list you already hold runs where the
  list is.** A call inside an entity query has to become SQL, and `osy check` refuses a call with no SQL form —
  compute it over a `.ToList()` instead.
- **A `live var` recomputes whenever anything it READ changes** — a state field, another `live var`, an entity
  query (which subscribes to the entity TYPE, so a commit here, on another page, or in another person's session
  refetches it), and the clock. A plain field's initialiser runs once, at mount. **Derive a number about X from a
  query over X** — a `live var` re-runs for the entities it reads, so an aggregate sourced from the entity that
  changes is the one that stays current on screen.
- **A composed child that reads data declares `skeleton { }`** — a second render tree, same grammar, that fills the
  child's window while its first read is in flight. A routed page awaits its own data before first paint, so the
  block belongs on the reading child. `osy docs ui-skeleton`.
- **There is one clock: `DateTime.UtcNow`.** In a `live var` or a render slot it ADVANCES on its own, so a countdown
  counts down; everywhere else it reads once. A `live var` whose initialiser is an entity query runs on the server,
  so its clock read is one-shot — for a value that must move while the page sits still, compute it over rows the
  client already has:

```text
live var stale = Item.Where(i => i.AddedAt < DateTime.UtcNow.AddDays(-90)).ToList();   // server query — reads once
live var items = Item.ToList();
live var due   = items.Where(i => i.AddedAt < DateTime.UtcNow.AddDays(-90)).ToList();  // client — and it ticks
```

To show an instant as somebody's local time, say whose:

```
entity Reading {
  [MaxLength(60)] string Label;
  DateTime TakenAt = DateTime.UtcNow;      // reads once, at create
  security { allow read, create when IsAnonymous || IsAuthenticated; }
}

[Page("/readings")]
[AllowAnonymous]
[Render(CSR)]
[Title("Readings")]
component Readings() {
  live var readings = Reading.OrderBy(r => r.TakenAt).Take(200).ToList();
  skeleton { Text("Loading readings…"); }        // see `Tickets` above — a server read owes one
  render {
    Stack {
      Text($"clock: {DateTime.UtcNow:HH:mm:ss}");                            // ticks
      foreach (var r in readings) {
        Text($"{r.Label} — {r.TakenAt.InZone(Zone.Of("Europe/Stockholm")):yyyy-MM-dd HH:mm}");
      }
    }
  }
}
```

## The toolchain — build, then diagnose

`osy` is on your PATH; run the verb. **This table is the loop, not the toolchain — bare `osy` lists every command.**

| when | run |
|---|---|
| is this LEGAL | **`osy validate`** — parse, resolve AND the real emitters, no database, under a second. Green means the compiler accepts it. |
| what does it DO | **`osy run <Function> --arg name=value`** — runs one of the app's own functions on the local platform; `--as <login>` to run as a user, anonymous otherwise; `--json` for the result. The verb for any behaviour question. |
| is the app GREEN | **`osy check`** — validate, then lint, then test, one verdict, failures only. The verb to finish on. |
| SEE it, on your own machine | **`osy compile`** puts the current source into your local platform; **`osy launch`** does that and opens a browser. Both start the platform on first use — there is no account and no server to set up. **`osy stop`** ends it when you are done. |
| a value is WRONG rather than a crash | **`osy trace start`**, reproduce, then **`osy inspect --json`** — client and server interleaved as one story, showing the values that CROSSED (`→ handoff` / `← resume`). Faults are captured even with tracing off. |
| what did it LOG | **`osy logs --tail`** — client AND server lines under one correlation id (`Log.*` is dual-sided). |
| how do I SPELL it | **`osy docs <topic>`** · **`osy kit <Name> <Name> …`** · `osy kit --atoms` |
| who can read what | **`osy explain`** — the declared security in plain English |
| the resolved model | **`osy model --json`** — entities, relations, each function's effects |

**When a docs term misses, escalate — one call answers it:** `osy docs --list <word> <word>` prints every page id,
narrowed (this IS the grep); `osy docs <area>` prints one area's index (`ui`, `query`, `security`, `testing`,
`workflow`, …). **The code in `osy docs` compiles** — a gate builds every example into a real app — so copy from it;
the few uncompiled fences are marked `syntax` or `preview` on the fence. `osy docs <page>#<anchor>` prints one
section (a unique partial matches, and a miss prints every anchor the page has); `--full` adds the essay when the
examples are not enough. Read the reply whole — the `related:` line and fence marks are the map to the next page.

## Tests that prove — *and the assertions that carry the proof*

Write and run a test for every observable user journey the brief states or implies.
Never omit an implied journey merely to simplify the application — a journey you leave untested is one you have
not built.

`osy test` IS the browser check: a `[Test]` calling `Ui.Visit`/`Ui.Click`/`Assert.Visible` drives the REAL page in a
real renderer against the real app and database — mounted, clicked, and asked what it shows. (`osy launch` opens a
desktop browser for a human; your verb is `osy test`.)

- **Prove data is SAVED by reading it back.** `Assert.Equal(1, Thing.Where(…).Count())` after the click — a screen
  assertion alone passes on a page that stores nothing.
- **Assert the VALUE, not the caption beside it.** `Assert.Visible("Bells oiled")` passes on a page showing 0. Give
  the value a labelled container and assert it: `Assert.TextIs("3", within: "Bells oiled")`.
- **A filter test asserts what DISAPPEARED.** Both rows were visible before the click, so the positive half passes
  when the filter does nothing:

```text
Ui.Click("Show only cracked");
Assert.Visible("Cracked Bell");         // necessary
Assert.Hidden("Sound Bell");            // the one that proves the filter RAN
```

- **Two lists on one page make every locator ambiguous; `within:` scopes it.** A locator matching two things
  REFUSES rather than picking one. **`within:` takes exactly two kinds of thing; everything else is the mistake:**

```text
// WHAT A SCOPE MATCHES
//   within: "words"   a CONTAINER whose `label:` holds those words — OR a ROW that reads them
//   within: entity    THAT ROW, by identity: no label, no title, no row text needed
//   anything else     REFUSED. A bare `Text("Tenor")` is neither — a heading does not scope the
//                     block under it, because nothing ties a span to what comes after it.

Card("Needs oiling") { foreach (var b in due) { Row { Text(b.Inscription); Button("Oil", …); } } }
Card("Your bells")   { foreach (var b in all) { Row { Text(b.Inscription); Button("Oil", …); } } }
//   a Card's TITLE becomes its `label:`, so it is scopable already. Name anything else yourself:
//   `Stack(label: "Totals") { … }`.

var tenor = Bell.Single(b => b.Inscription == "Tenor");
Ui.Click("Oil", within: "Needs oiling");                        // by container label
Ui.Click("Oil", within: tenor);                                 // by row identity
Ui.Within("Your bells") { Assert.Hidden("Tenor"); }             // a block, for several verbs
Ui.Within("Needs oiling") { Ui.Click("Oil", within: tenor); }   // scopes COMPOSE, outer → inner
```

  ⛔ **A DIALOG CONFINES EVERY LOCATOR TO ITSELF.** While one is open, `within:` something BEHIND it cannot
  match — the page behind a scrim is inert, and that is what a modal is. So the order matters:

```text
Ui.Click("Oil", within: tenor);            // opens the dialog
Ui.Fill("Oiled by", "Ada", within: tenor); // ✗ REFUSED — that row is behind the scrim
Ui.Fill("Oiled by", "Ada");                // ✓ you are already inside the dialog; scope nothing
```

  ⚑ **Prefer `within: <entity>`.** It needs no label, survives a rename of the text, and says WHICH ROW rather
  than which words — the one form that cannot go ambiguous as the page grows.

- **A green with SKIPPED tests is an open question, not a pass.** When `osy check`/`osy test` reports skips, find
  out why and say so before reporting success — a suite whose UI tests all skipped has proven nothing about the UI.
- **Size at least one fixture like real data.** A derived number that reads sensibly over 4 rows can be meaningless
  over 500; one test seeds a realistic count and asserts the number still means something.

## How a project is laid out

Decide the layout before you write — the file you put something in is where you will edit it all session:

```text
app.osy                    the manifest — the globs below, and any `use` dependency
model/theme.osy            the theme declaration
model/auth.osy             [Principal], [AuthMethod], the role enum, policies — ONLY if people sign in
model/<domain>.osy         entities + the functions that act on them — named for the THING (orders, bookings),
                           one file per area
model/pages/<page>.osy     ONE FILE PER PAGE — pages are what you revise most
tests/<name>.test.osy      the tests — the `.test.osy` suffix, always
```

```
app TaskBoard {
  model "model/**/*.osy";
  tests "tests/**/*.osy";
}
```

- **Put every source file where a glob collects it** — a `.osy` file no glob matches is not part of the app, and
  what it declares reads as undefined where it is used. If you invent a folder, declare it in the manifest.
- **An icon file's name becomes an identifier in every file** (`icons/mark.svg` declares `mark`) — name icons so
  they collide with nothing, and keep `left`, `right`, `top`, `value`, `label`, `rows` for the style props that own
  them.
- **A scaffold's example files get taken over AS you write** — rename its entity to yours, rewrite its page and its
  test, so two models never exist side by side. Before you finish: nothing named after the example remains, and
  `osy validate` is green after the deletion.

## How to work — WRITE THE FILES. Planning twice is stalling.

Nobody will answer a question and nothing here can be damaged, so:

0. ⛔ **PLAN ONCE, THEN WRITE. If you are restating the model, the screens or the decisions a SECOND time, you are
   not planning — you are stalling, and the run ends with nothing.** The moment you can name the files, write them.
   A draft that compiles beats a plan that is right, because the compiler corrects a draft and nothing corrects a
   plan. ⚠ **"Actually, one more consideration…" after you have decided to write IS the failure** — that sentence
   has cost real runs their entire budget. Decide, write, and let `osy validate` be the thing that objects.
   ⚠ **And do not draft the code in your head — draft it in the FILE.** Measured: a run's largest thinking block
   held a complete entity, attributes and `security` block and all, written out in full — then it wrote the same
   thing again into the file. Code composed in thinking is billed as output, cannot be validated, and is thrown
   away the moment the real version is written. A file is cheaper than a plan, and unlike a plan it can be checked.
1. **Execute immediately.** Where the brief left a decision open, make it, build so the app ACTS on it, and write
   the decision as the comment beside what it decided — that is where the next layer's planning finds it.
2. **Write the whole app, then validate once.** All the files — entities, pages, theme, tests — then one
   `osy validate`; fix everything it reports in ONE pass; validate again. Five errors cost exactly what one costs.
   Ask for every control in one call (`osy kit Field Card Badge Button Dialog`), and let `osy check` run all three
   gates with one verdict.
3. **Ask the tools, not yourself.** "Will this compile" is `osy validate`; "what does it do" is `osy run`; "how is
   it spelled" is `osy kit`/`osy docs`. Each answers in a second, and the answer is true. Write the version of the
   screen you actually want and let the compiler correct you — retreating to a "safer" control you already know
   ships a worse screen and saves nothing.
4. **Finish on `osy check`, run — not predicted.** Fix every error and every lint MUST (both name real defects);
   read the SHOULD/CONSIDER advisories and act on the behavioural ones. Write the tests too, driving the app the
   way a person uses it — that is what proves a person can actually get in.
5. **If something is genuinely not expressible, say so plainly** — an honest gap is useful; invented syntax is
   expensive.

## The rest of the rules worth caching

1. Members are `PascalCase`; parameters and component fields are `camelCase`.
2. Every entity already has `Id`, `CreatedAt`, `ModifiedAt`, `CreatedBy`, `ModifiedBy` — use them.
3. Assertions are xUnit-shaped: `Assert.Equal(a, b)` · `NotEqual` · `Null` · `NotNull` · `Empty` · `NotEmpty` ·
   `True` · `False` · `Visible` · `Hidden` · `TextIs` — and ~30 MORE, so do not read that as the set. There are
   assertions for a control's state (`Enabled`/`Disabled`/`Checked`/`Focused`), for on-screen ORDER (`Before`,
   `Above`), for counts, cells, dialogs and refusals. `osy docs testing-assert` is the whole list.
4. A page renders on the CLIENT, so a render slot shows sendable results — read data in a `live var` and render
   that.
