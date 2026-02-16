import salesforceLogo from "../../assets/Salesforce Logo.jpeg";
import { SearchBar } from "../SearchBar";
import { ConfigDropdown } from "./ConfigDropdown";
import { useTheme } from "../../contexts/ThemeContext";

const isDev = import.meta.env.DEV;

interface CustomerItem {
  id: string;
  name: string;
}

interface HeaderProps {
  customers: CustomerItem[];
}

export const Header = ({ customers }: HeaderProps) => {
  const theme = useTheme();
  const logoSrc = theme.logoUrl || (theme.labels.siteName === "Salesforce" ? salesforceLogo : undefined);
  return (
    <header className="w-full bg-white border-b border-gray-200/90 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <a
              href={theme.homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={theme.labels.siteName}
                  className="h-7 sm:h-8 object-contain"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)]">
                  {theme.labels.siteName}
                </span>
              )}
              {logoSrc && (
                <span className="text-xl sm:text-2xl font-semibold text-[var(--theme-primary)]">
                  {theme.labels.siteName}
                </span>
              )}
            </a>
            <div className="border-l border-gray-300 h-6"></div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                {theme.labels.helpLabel}
              </h1>
            </div>
            {isDev && (
              <>
                <div className="border-l border-gray-300 h-6 hidden sm:block" aria-hidden />
                <ConfigDropdown />
              </>
            )}
          </div>
        </div>
        {customers.length > 0 && (
          <div className="w-full pb-4">
            <div className="w-full max-w-2xl mx-auto min-w-0">
              <SearchBar />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

