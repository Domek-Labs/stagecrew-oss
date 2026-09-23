# Component Registry — Markdown catalog

**Copied by:** `/init-agents` into the repo at the resolved `components.registry_path` (typically `docs/components.md`).

**Purpose:** the canonical, per-component catalog. Every component in the repo's `code_globs` scope that is meant to be reused should have an entry here. Entries carry the naming, the code path, the public API, the backend contract (if applicable), and the anti-patterns. When a new issue lands, the loop uses this file plus the code layer to decide "reuse or ADR".

**Enforcement level** is set in `AGENTS.md` under `components.usage_policy`:
- `prefer_existing` — Validator warns, Critic runs dupe detection.
- `strict` — Validator STOPs an in-scope issue unless it references an entry from this file OR links an ADR in the issue's `## Standards Override` block.

Delete this instruction block and the examples below once your first real entries are in place.

---

## Component: `DataTable` (frontend example)

### Purpose

Canonical table for tabular data across the app — list views, admin screens, search results. Use for anything with rows + columns that needs sorting, filtering, pagination, or selection.

**When to use:** any tabular presentation of records with more than 5 rows, especially if the backend already returns a `filter+sort+paginate` response shape.

**When NOT to use:** a simple 2-3 row summary (use a plain `<table>` or a definition list). Highly custom layouts that are not row/column-shaped (use a bespoke component + ADR).

### Code path

`src/components/DataTable/DataTable.tsx` (the source of truth). Sub-parts:
- `DataTable.tsx` — the container + prop surface
- `DataTable.Column.tsx` — column config
- `DataTable.Row.tsx` — row render slot
- `useDataTableState.ts` — controlled + uncontrolled state hook

### Public API summary

```ts
type DataTableProps<Row> = {
  rows: Row[];
  columns: Array<DataTableColumn<Row>>;
  variant?: "default" | "compact" | "dense";
  onSort?: (col: string, dir: "asc" | "desc") => void;
  onFilter?: (filter: Record<string, string>) => void;
  onPageChange?: (page: number) => void;
  selection?: "none" | "single" | "multi";
  onSelectionChange?: (selectedIds: string[]) => void;
};
```

Variants live on one component (`variant` prop) — do **not** create sibling components like `CompactTable` or `DenseTable`.

### Backend contract shape

The table expects the backend endpoint that feeds it to respond with:

```ts
type DataTableResponse<Row> = {
  rows: Row[];
  total: number;         // for pagination
  page: number;
  page_size: number;
  applied_filters: Record<string, string>;
  applied_sort: { column: string; direction: "asc" | "desc" } | null;
};
```

New endpoints that feed a `DataTable` MUST return this shape. Diverging shapes go through an ADR.

### Anti-patterns

- **Inline `<table>` with hand-rolled sort logic.** Use `DataTable` with `onSort`.
- **Copying `DataTable.tsx` to a sibling folder** to add one new prop. Add the prop to the canonical file behind a variant or a discriminated feature flag.
- **New response shape per endpoint.** Reuse `DataTableResponse<Row>` or file an ADR.
- **Client-side pagination when the total row count exceeds ~500.** Push pagination to the backend.

---

## Component: `Money` (backend value object example)

### Purpose

Canonical value object for monetary amounts across the domain layer. Encapsulates the amount and its currency, forbids implicit float arithmetic, guarantees invariants (no mixing currencies without an explicit conversion step).

**When to use:** anywhere a domain entity or aggregate carries a price, a fee, a balance, a total, a subtotal, or a discount. Any monetary field on any DTO going into or out of the domain layer.

**When NOT to use:** display-only string rendering in the view layer (use a formatter). Statistical aggregates over historical data where the amount is a plain number (report layer, not domain layer).

### Code path

`src/domain/value-objects/Money.ts` (the source of truth). Related:
- `src/domain/value-objects/Currency.ts` — the currency VO used by `Money`
- `src/domain/services/CurrencyConversion.ts` — the only place that mixes currencies

### Public API summary

```ts
class Money {
  static of(amount: number | string, currency: Currency | string): Money;
  static zero(currency: Currency | string): Money;

  readonly amount: bigint;      // stored as minor units (cents)
  readonly currency: Currency;

  add(other: Money): Money;     // throws on currency mismatch
  subtract(other: Money): Money;
  multiply(factor: number): Money;
  isZero(): boolean;
  isNegative(): boolean;
  equals(other: Money): boolean;

  toString(): string;           // "12.34 EUR"
  toMinorUnits(): bigint;
}
```

All operations are pure. Currency-mixing operations throw a `CurrencyMismatchError` — cross-currency arithmetic must go through `CurrencyConversion.convert()`.

### Anti-patterns

- **`number` for prices in domain code.** Use `Money`. Even one field slipping through leaks float rounding into the aggregate.
- **`amount: number, currency: string` DTO fields inside the domain layer.** Convert at the boundary; keep the interior typed as `Money`.
- **Ad-hoc arithmetic like `price * 1.19`** for tax. Model tax as a domain concept (a `TaxRate` VO returning a `Money` delta), not as a magic number.
- **Comparing two `Money` instances with `===` or `==`.** Use `.equals()`. The identity comparison passes only for cached instances.
