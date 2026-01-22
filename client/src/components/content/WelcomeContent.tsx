import type { ChatWidgetProps } from "../../types/message";
import { ChatWindow } from "../chat/ChatWindow";
import { Badge } from "@/components/ui/badge";

interface WelcomeContentProps extends ChatWidgetProps {}

export const WelcomeContent = ({
  messages,
  onMessageClick,
  onSendMessage,
  onDeleteSession,
  onStartNewSession,
  sessionInitialized,
  isLoading,
  fetchingHudmoFor = new Set(),
  prefetchedHudmoData = new Map(),
}: WelcomeContentProps) => {
  return (
    <div className="w-full bg-gray-50 min-h-[calc(100vh-200px)]">
      {/* Hero Introduction - Salesforce Help Style */}
      <section className="py-4 sm:py-6 md:py-8 px-4 sm:px-6 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-2 sm:space-y-3 md:space-y-4">
            <div className="inline-block">
              <Badge variant="secondary" className="bg-[#0176D3] text-white hover:bg-[#014486] border-0 text-xs sm:text-sm px-2 sm:px-3 py-1">
                Salesforce Help Portal
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight px-2">
              Welcome to Salesforce Help
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed max-w-3xl mx-auto px-2">
              Salesforce Help on Enterprise Knowledge demo site
            </p>
          </div>
        </div>
      </section>

      {/* Embedded Chat Widget */}
      <section className="py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <ChatWindow
              messages={messages}
              onMessageClick={onMessageClick}
              onSendMessage={onSendMessage}
              onDeleteSession={onDeleteSession}
              onStartNewSession={onStartNewSession}
              sessionInitialized={sessionInitialized}
              isLoading={isLoading}
              onClose={() => {}}
              embedded={true}
              fetchingHudmoFor={fetchingHudmoFor}
              prefetchedHudmoData={prefetchedHudmoData}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
