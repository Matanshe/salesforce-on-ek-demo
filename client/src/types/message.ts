export interface ChunkRow {
  Chunk__c?: string;
  Citation__c?: string | null;
}

export interface CitedReference {
  id: string;
  name?: string;
  url?: string;
  type?: string;
}

export interface QAPair {
  question?: string;
  answer?: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  sender: "user" | "bot";
  type?: string;
  feedbackId?: string;
  isContentSafe?: boolean;
  message?: string;
  metrics?: Record<string, unknown>;
  planId?: string;
  result?: unknown[];
  citedReferences?: CitedReference[];
  properties?: Record<string, unknown>;
  htmlContent?: string;
  dccid?: string;
  hudmo?: string;
  /** Chunk params from citation URL (for highlight); set when prefetch has chunk params */
  chunkObjectApiName?: string;
  chunkRecordIds?: string;
  qa?: QAPair[];
  summary?: string;
  /** Article title from get-hudmo (attributes.title), set when we have the response */
  articleTitle?: string;
}

/** Data for the citation hover card (metadata, title, source, summary, Copy/Preview) */
export interface CitationHoverCardData {
  title?: string | null;
  originalContentType?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  summary?: string | null;
  chunkPreview?: string | null;
  lastUpdated?: string | null;
  originalFormat?: string | null;
}

export interface ChatWidgetProps {
  messages: Message[];
  onMessageClick: (message: Message) => void;
  onSendMessage: (content: string) => void;
  onDeleteSession: () => void;
  onStartNewSession: () => void;
  sessionInitialized: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  minimized?: boolean;
  fetchingHudmoFor?: Set<string>;
  prefetchedHudmoData?: Map<string, unknown>;
  /** When "modal", citations open in modal; used for hover tooltip and behavior */
  citationBehavior?: "fullPage" | "modal";
  /** Chunk preview text per message id (for tooltip in modal mode) */
  chunkPreviewByMessageId?: Record<string, string>;
  /** Hover card data per message id (metadata, title, source, summary for citation hover card) */
  hoverCardDataByMessageId?: Record<string, CitationHoverCardData | null>;
  /** Which message's citation hover card is active (card shown in slot above input) */
  activeHoverCitationMessageId?: string | null;
  /** Called when citation hover starts (messageId) or ends (null) so parent can show card in slot */
  onCitationHoverChange?: (messageId: string | null) => void;
  /** Schedule hiding the citation card after delay (e.g. when mouse leaves citation or card) */
  onCitationHoverScheduleHide?: () => void;
  /** Cancel scheduled hide (e.g. when mouse enters card slot so card stays visible) */
  onCitationHoverCancelHide?: () => void;
  /** Called when user hovers citation in modal mode so parent can fetch chunk preview */
  onHoverCitation?: (message: Message) => void;
}
