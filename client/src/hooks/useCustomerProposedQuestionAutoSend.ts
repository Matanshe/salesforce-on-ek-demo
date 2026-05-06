import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type LocationState = { proposedQuestion?: string } | null | undefined;

/**
 * Loads optional `proposedQuestion` from React Router location state (landing) or the customer API,
 * then once the chat session is ready sends it once after a short delay (toast while waiting).
 * When `autoProposeEnabled` is false, no fetch/send runs (toggle off).
 * Uses a ref for `onSendMessage` so the send effect does not re-subscribe when the callback identity changes.
 */
export function useCustomerProposedQuestionAutoSend(
  customerId: string,
  sessionInitialized: boolean,
  onSendMessage: (content: string) => void | Promise<void>,
  locationState: unknown,
  autoProposeEnabled: boolean
) {
  const [proposedQuestion, setProposedQuestion] = useState<string | null>(null);
  const proposedQuestionSentRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  useEffect(() => {
    if (!autoProposeEnabled) {
      setProposedQuestion(null);
      return;
    }
    const fromState = (locationState as LocationState)?.proposedQuestion;
    if (fromState) {
      setProposedQuestion(fromState);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers/${encodeURIComponent(customerId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.customer?.proposedQuestion) {
          setProposedQuestion(data.customer.proposedQuestion);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId, locationState, autoProposeEnabled]);

  useEffect(() => {
    if (!autoProposeEnabled) {
      setToastMessage(null);
      return;
    }
    if (!sessionInitialized || !proposedQuestion || proposedQuestionSentRef.current) return;
    proposedQuestionSentRef.current = true;
    const question = proposedQuestion;
    setToastMessage("Proposing a question based on customer content…");
    const sendDelayMs = 2000;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setToastMessage(null);
      setProposedQuestion(null);
      Promise.resolve(onSendMessageRef.current(question)).then(
        () => {},
        () => {
          proposedQuestionSentRef.current = false;
        }
      );
    }, sendDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
      proposedQuestionSentRef.current = false;
    };
  }, [autoProposeEnabled, sessionInitialized, proposedQuestion]);

  return { toastMessage };
}
