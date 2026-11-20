# BwDataView

> Namespace: `BieberWorks.SDK.UI.Blazor.MudBlazor.DataView`  
> Package: `BieberWorks.SDK.UI.Blazor.MudBlazor`

`BwDataView<TItem>` is a unified data presentation component that automatically switches between a **MudDataGrid** (desktop, `md+`) and a **card list** (mobile, `sm` and below). Columns, filters, sorting, and row actions are declared once via `BwColumn<TItem>` and applied to both viewports without duplication.

---

## Features

- Automatic Grid / Card layout switching at the `md` breakpoint
- Filter drawer (mobile) — generated from `BwColumn.FilterType`
- Native column-header filters (desktop) — via `EnableNativeFilter` + `BwColumn.FilterTemplate`
- Global search box — client-side (Items branch) or server-driven (ServerData branch via `OnSearch`)
- Column sorting — columns with `Sortable="true"` and a `PropertyName`
- Column visibility persistence — per `ViewId` in `localStorage` (`bw-dataview:{ViewId}`)
- Row actions — rendered as the last desktop column and as card footer buttons
- Server paging — via `ServerData` callback (`GridState<TItem>` → `GridData<TItem>`)
- Row grouping — opt-in via `EnableGrouping` + per-column `Groupable`

---

## Imports

Add to `_Imports.razor` (or per page):

```razor
@using BieberWorks.SDK.UI.Blazor.MudBlazor.DataView
```

---

## Basic example (in-memory)

```razor
<BwDataView TItem="OrderDto"
            Items="_orders"
            ViewId="order_list"
            Striped="true"
            Hover="true">
    <Columns>

        <BwColumn TItem="OrderDto"
                  Title="Customer"
                  Value="o => o.CustomerName"
                  PropertyName="CustomerName"
                  Sortable="true"
                  FilterType="BwFilterType.Text"
                  IsCardTitle="true" />

        <BwColumn TItem="OrderDto"
                  Title="Status"
                  Value="o => o.Status"
                  PropertyName="Status"
                  Sortable="true"
                  FilterType="BwFilterType.Select"
                  FilterOptions="() => Enum.GetNames<OrderStatus>()" />

        <BwColumn TItem="OrderDto"
                  Title="Created"
                  Value="o => o.CreatedAt.ToString("yyyy-MM-dd")"
                  PropertyName="CreatedAt"
                  Sortable="true"
                  FilterType="BwFilterType.DateRange" />

    </Columns>

    <RowActions Context="order">
        <MudIconButton Icon="@Icons.Material.Filled.Edit"
                       Size="Size.Small"
                       OnClick="@(() => Edit(order.Id))" />
    </RowActions>
</BwDataView>
```

---

## Server-paging example

```razor
<BwDataView TItem="OrderDto"
            ServerData="LoadAsync"
            ViewId="order_list_server"
            ShowSearch="true"
            OnSearch="OnSearchChanged">
    <Columns>
        <BwColumn TItem="OrderDto"
                  Title="Customer"
                  Value="o => o.CustomerName"
                  PropertyName="CustomerName"
                  Sortable="true" />
    </Columns>
</BwDataView>

@code {
    private string _search = "";

    private async Task<GridData<OrderDto>> LoadAsync(GridState<OrderDto> state, CancellationToken ct)
    {
        var sort = state.SortDefinitions.FirstOrDefault();
        var result = await _service.GetPagedAsync(
            page:       state.Page,
            pageSize:   state.PageSize,
            sortField:  sort?.SortBy,
            descending: sort?.Descending ?? false,
            search:     _search,
            ct:         ct);

        return new GridData<OrderDto> { Items = result.Items, TotalItems = result.TotalCount };
    }

    private Task OnSearchChanged(string term)
    {
        _search = term;
        // BwDataView reloads the grid automatically after raising OnSearch
        return Task.CompletedTask;
    }
}
```

---

## Custom cell content

Use `<CellContent>` to replace the default text cell on desktop, and `<CardFieldContent>` to replace the default field line in the mobile card:

```razor
<BwColumn TItem="OrderDto"
          Title="Status"
          Value="o => o.Status"
          PropertyName="Status">
    <CellContent Context="order">
        <MudChip Color="@StatusColor(order.Status)" Size="Size.Small">@order.Status</MudChip>
    </CellContent>
    <CardFieldContent Context="order">
        <MudChip Color="@StatusColor(order.Status)" Size="Size.Small">@order.Status</MudChip>
    </CardFieldContent>
</BwColumn>
```

---

## BwDataView — parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Items` | `IEnumerable<TItem>?` | — | In-memory collection. Mutually exclusive with `ServerData`. |
| `ServerData` | `Func<GridState<TItem>, CancellationToken, Task<GridData<TItem>>>?` | — | Server-paging callback. Mutually exclusive with `Items`. |
| `ViewId` | `string?` | `null` | Enables column-visibility persistence. Stored as `bw-dataview:{ViewId}` in `localStorage`. |
| `Striped` | `bool` | — | Alternating row colours (desktop grid). |
| `Hover` | `bool` | — | Row hover highlight (desktop grid). |
| `Dense` | `bool` | — | Compact row height (desktop grid). |
| `Title` | `string?` | — | Optional title rendered above the grid. |
| `RowsPerPage` | `int` | — | Rows per page. |
| `PageSizeOptions` | `int[]?` | — | Available page-size options in the pager. |
| `ShowSearch` | `bool` | `true` | Renders a search box in the toolbar. Items branch: built-in full-text filter. ServerData branch: only shown when `OnSearch` is bound. |
| `SearchPlaceholder` | `string?` | `"Search…"` | Placeholder text for the search input. |
| `OnSearch` | `EventCallback<string>` | — | Raised on search-term change (ServerData branch only). Grid reloads automatically after the callback returns. |
| `QuickFilterFunc` | `Func<TItem, bool>?` | — | Additional client-side filter function (Items branch only). |
| `EnableNativeFilter` | `bool` | `true` | Enables MudDataGrid native column-header filters on desktop. |
| `FilterMode` | `DataGridFilterMode` | `ColumnFilterMenu` | Desktop filter mode: `Simple`, `ColumnFilterMenu`, or `ColumnFilterRow`. |
| `EnableResize` | `bool` | `true` | Column resize handles. |
| `EnableColumnReorder` | `bool` | `true` | Drag-and-drop column reordering + columns panel. |
| `EnableGrouping` | `bool` | `false` | Row grouping. Individual columns also opt in via `BwColumn.Groupable`. |
| `GridRef` | `MudDataGrid<TItem>?` | — | Exposes the internal grid ref for external `ReloadServerData()` calls. |
| `GridRefChanged` | `EventCallback<MudDataGrid<TItem>>` | — | Fired when the internal grid ref is assigned. |

**RenderFragment slots:**

| Slot | Description |
|------|-------------|
| `<Columns>` | `BwColumn<TItem>` definitions |
| `<RowActions Context="item">` | Rendered as the last desktop column and as card footer |
| `<ToolbarContent>` | Additional toolbar content above the grid (both viewports) |
| `<NoRecordsContent>` | Empty-state content (default: "No records found.") |

---

## BwColumn — parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Title` | `string` | — | Column header label / card field label |
| `Value` | `Func<TItem, object?>?` | — | Value projection used for default cell text and card field |
| `PropertyName` | `string?` | `null` | Property name used as the sort field in MudDataGrid. `null` = not sortable. |
| `Key` | `string?` | `null` | Stable identifier for column-visibility persistence (unique per view). Falls back to `PropertyName` → `Title`. |
| `Sortable` | `bool` | — | Participates in sorting (desktop header + mobile sort menu) |
| `InitialDirection` | `SortDirection` | `None` | Initial sort direction |
| `FilterType` | `BwFilterType` | `None` | Filter control type in the mobile filter drawer |
| `FilterDebounce` | `int` | — | Debounce interval in ms for `BwFilterType.Text` |
| `FilterOptions` | `Func<IEnumerable<string>>?` | — | Option factory for `Multiselect` / `Select` filter types |
| `FilterTreeNodes` | `Func<IEnumerable<BwFilterNode>>?` | — | Tree nodes for `BwFilterType.Tree`. SDK builds the tree filter automatically. |
| `GetItemFilterKeys` | `Func<TItem, IEnumerable<string>>?` | — | Required with `FilterTreeNodes`: projects an item to its filter keys |
| `GetFilterValue` | `Func<object?>?` | — | Returns the current filter value (used to pre-populate drawer + build chip summary) |
| `OnFilterChanged` | `EventCallback<object?>` | — | Raised on filter-value change. Type: `string?`, `HashSet<string>?`, `(DateTime?, DateTime?)`, or `null` (reset) |
| `FilterTemplate` | `RenderFragment<FilterContext<TItem>>?` | — | Custom filter UI for the native desktop column-header filter (requires `EnableNativeFilter=true` + `NativeFilterable=true`) |
| `NativeFilterable` | `bool` | `true` | Enables the native column-header filter. Only effective when `FilterTemplate` is set and `EnableNativeFilter=true`. |
| `IsCardTitle` | `bool` | `false` | Column value used as the card's primary title (first occurrence wins) |
| `HideInCard` | `bool` | `false` | Suppresses this column in the mobile card body |
| `Hideable` | `bool` | `true` | User can hide this column via the columns panel (requires `ViewId`) |
| `Groupable` | `bool` | `false` | Participates in row grouping (requires `EnableGrouping=true`) |
| `Resizable` | `bool` | `true` | Column can be resized by the user |
| `DragAndDropEnabled` | `bool` | `true` | Column can be reordered via drag-and-drop |
| `HeaderStyle` | `string?` | — | Inline style on the desktop column header (e.g. `"width:120px"`) |

**RenderFragment slots on BwColumn:**

| Slot | Description |
|------|-------------|
| `<CellContent Context="item">` | Custom desktop grid cell content (chips, links, badges …). Falls back to `Value.ToString()`. |
| `<CardFieldContent Context="item">` | Custom mobile card field content. Falls back to `Title: Value`. |
| `<FilterTreeContent>` | Manual render fragment for `BwFilterType.Tree` when `FilterTreeNodes` is not used. |

---

## BwFilterType values

| Value | Description |
|-------|-------------|
| `None` | No filter for this column |
| `Text` | Free-text contains filter (debounced `MudTextField`) |
| `Select` | Single-select dropdown (`MudSelect`) |
| `Multiselect` | Multi-select checkbox list |
| `DateRange` | Date-range pair: two `MudDatePicker` controls (From / To) |
| `Tree` | Hierarchical checkbox tree via `FilterTreeNodes` or `FilterTreeContent` |

---

## Notes

- **`ViewId` must be unique per page.** Two views sharing the same `ViewId` overwrite each other's `localStorage` state.
- **`PropertyName` is the sort key**, not the `Value` projection. It must match the DTO property name exactly (case-sensitive, as MudDataGrid expects).
- **`CellContent` replaces `Value` in the desktop grid only.** For the mobile card, use `CardFieldContent`.
- **`FilterTemplate` is desktop-only.** Mobile always uses the filter drawer regardless of `EnableNativeFilter`.
- **`RowActions`** is rendered once but appears in both viewports — as the last desktop column and as a card footer area.
- **`IsCardTitle`** should be set on the primary identifier column (e.g. name, title) so the mobile card has a meaningful heading.
