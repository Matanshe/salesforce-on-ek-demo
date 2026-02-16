/**
 * Config/customer selector. Shown only in development (see Header).
 */
export function ConfigDropdown() {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="config-select" className="text-sm font-medium text-gray-600 shrink-0">
        Config
      </label>
      <select
        id="config-select"
        className="text-sm rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-700 focus:border-[#0176D3] focus:outline-none focus:ring-1 focus:ring-[#0176D3]"
        aria-label="Configuration (dev only)"
      >
        <option value="salesforce">Salesforce</option>
        <option value="stryker">Stryker</option>
      </select>
    </div>
  );
}
