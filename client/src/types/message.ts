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
  qa?: QAPair[];
  summary?: string;
  /** Article title from get-hudmo (attributes.title), set when we have the response */
  articleTitle?: string;
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
}
