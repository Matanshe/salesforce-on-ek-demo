import salesforceLogo from "../../assets/Salesforce Logo.jpeg";
import { CustomerSelector } from "../CustomerSelector";
import { useTheme } from "../../contexts/ThemeContext";

interface HeaderProps {
  onCustomerChange: (customerId: string | null) => void;
}

export const Header = ({ onCustomerChange }: HeaderProps) => {
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
          </div>
          <CustomerSelector onCustomerChange={onCustomerChange} />
        </div>
      </div>
    </header>
  );
};

