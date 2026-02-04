import salesforceLogo from "../../assets/Salesforce Logo.jpeg";
import { SearchBar } from "../SearchBar";

export const Header = () => {
  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo + Help title */}
        <div className="flex items-center justify-center gap-3 py-3">
          <a 
            href="https://www.salesforce.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img 
              src={salesforceLogo} 
              alt="Salesforce" 
              className="h-7 sm:h-8 object-contain"
            />
            <span className="text-xl sm:text-2xl font-semibold text-[#0176D3]">Salesforce</span>
          </a>
          <div className="border-l border-gray-300 h-6 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
              Help
            </h1>
          </div>
        </div>
        {/* Search bar - full width row so it's always visible */}
        <div className="w-full pb-3">
          <div className="w-full max-w-2xl mx-auto min-w-0">
            <SearchBar />
          </div>
        </div>
      </div>
    </header>
  );
};

