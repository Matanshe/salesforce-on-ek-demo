import salesforceLogo from "../../assets/Salesforce Logo.jpeg";
import { SearchBar } from "../SearchBar";
import { ConfigDropdown } from "./ConfigDropdown";

const isDev = import.meta.env.DEV;

export const Header = () => {
  return (
    <header className="w-full bg-white border-b border-gray-200/90 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-3 py-3">
          <a
            href="https://www.salesforce.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-85 transition-opacity"
          >
            <img src={salesforceLogo} alt="Salesforce" className="h-7 sm:h-8 object-contain" />
            <span className="text-xl sm:text-2xl font-semibold text-[#0176D3]">Salesforce</span>
          </a>
          <div className="border-l border-gray-300 h-6 hidden sm:block" aria-hidden />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Help</h1>
          {isDev && (
            <>
              <div className="border-l border-gray-300 h-6 hidden sm:block" aria-hidden />
              <ConfigDropdown />
            </>
          )}
        </div>
        <div className="w-full pb-4">
          <div className="w-full max-w-2xl mx-auto min-w-0">
            <SearchBar />
          </div>
        </div>
      </div>
    </header>
  );
};

