import type { ChatWidgetProps } from "../../types/message";
import { ChatWindow } from "../chat/ChatWindow";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "../../contexts/ThemeContext";

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
  citationBehavior,
  chunkPreviewByMessageId,
  hoverCardDataByMessageId,
  activeHoverCitationMessageId,
  onCitationHoverChange,
  onCitationHoverScheduleHide,
  onCitationHoverCancelHide,
  onHoverCitation,
}: WelcomeContentProps) => {
  const theme = useTheme();
  return (
    <div className="w-full bg-gray-50 min-h-[calc(100vh-200px)]">
      <section className="py-4 sm:py-6 md:py-8 px-4 sm:px-6 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-2 sm:space-y-3 md:space-y-4">
            <div className="inline-block">
              <Badge variant="secondary" className="bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary-hover)] border-0 text-xs sm:text-sm px-2 sm:px-3 py-1">
                {theme.labels.welcomeBadge}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight px-2">
              {theme.labels.welcomeTitle}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed max-w-3xl mx-auto px-2">
              {theme.labels.welcomeSubtitle}
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
              citationBehavior={citationBehavior}
              chunkPreviewByMessageId={chunkPreviewByMessageId}
              hoverCardDataByMessageId={hoverCardDataByMessageId}
              activeHoverCitationMessageId={activeHoverCitationMessageId}
              onCitationHoverChange={onCitationHoverChange}
              onCitationHoverScheduleHide={onCitationHoverScheduleHide}
              onCitationHoverCancelHide={onCitationHoverCancelHide}
              onHoverCitation={onHoverCitation}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
