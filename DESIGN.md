# Tally UI decisions
<!-- keel:start -->
The repository contains no Product Frontend Design skill. These decisions supply
the short design log required by keel-build; they do not change PRODUCT.md.

- A quiet ledger workspace: warm off-white canvas, white panels, dark ink and a
  restrained terracotta accent. Use system fonts and local assets only.
- Persistent left navigation for Transactions, Categories, Summary and Settings.
  Collapse to a wrapping top row on narrow windows; content remains scrollable.
- Transactions are the starting view. Show the list, a clear empty state and one
  prominent Add transaction action. CSV actions appear only when their slice exists.
- Use real table headings, labelled fields, keyboard-visible focus and native
  dialogs with focus restoration. Errors persist in a live alert; successes in a status.
- Money is right-aligned with tabular numerals. Explicitly explain that negative
  values are spending and positive values are income. Never communicate sign by colour alone.
- Transaction editing uses one reusable form. Category selection and note are optional.
- CSV import shows detected delimiter/header, editable mapping/date order, then a
  preview, duplicate count and rejected row line/reason. Confirmation is a separate action.
- Monthly budgets show simple progress bars plus exact textual amounts left/over.
- Search/filter controls are grouped together; export clearly applies to shown rows.
- Undo is one visible action with the operation named. Any intervening mutation clears it.
- The browser test mode displays a visible mock badge; native product mode identifies local storage.
- Pixel baselines show deterministic empty views, without the current date or random identifiers.
<!-- keel:end -->
