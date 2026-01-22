export const Footer = () => {
  return (
    <footer className="w-full bg-gray-50 border-t border-gray-200 py-4 sm:py-6 md:py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 md:gap-6">
          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
            <a
              href="https://www.salesforce.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-gray-600 hover:text-[#0176D3] transition-colors"
            >
              Salesforce.com
            </a>
            <a
              href="https://help.salesforce.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-gray-600 hover:text-[#0176D3] transition-colors"
            >
              Help & Training
            </a>
            <a
              href="https://trailhead.salesforce.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-gray-600 hover:text-[#0176D3] transition-colors"
            >
              Trailhead
            </a>
            <a
              href="https://developer.salesforce.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-gray-600 hover:text-[#0176D3] transition-colors"
            >
              Developer Center
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
          <p className="text-[10px] sm:text-xs text-gray-500 px-2">
            © {new Date().getFullYear()} salesforce.com, inc. All rights reserved. Various trademarks held by their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
};
