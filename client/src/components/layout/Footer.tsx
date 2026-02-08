import { useTheme } from "../../contexts/ThemeContext";
import { formatFooterCopyright } from "../../types/theme";

export const Footer = () => {
  const theme = useTheme();
  return (
    <footer className="w-full bg-gray-50 border-t border-gray-200 py-4 sm:py-6 md:py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 md:gap-6">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
            {theme.footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm text-gray-600 hover:text-[var(--theme-primary)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="text-center mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
          <p className="text-[10px] sm:text-xs text-gray-500 px-2">
            {formatFooterCopyright(theme.labels.footerCopyright)}
          </p>
        </div>
      </div>
    </footer>
  );
};
