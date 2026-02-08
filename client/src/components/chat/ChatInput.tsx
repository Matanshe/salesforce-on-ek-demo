import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
}

export const ChatInput = ({ onSend }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-2 sm:p-3 md:p-4 bg-white shrink-0">
      <div className="flex gap-1.5 sm:gap-2 items-end">
        <Textarea
          ref={textareaRef}
          id="chatInput"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1 min-h-[36px] sm:min-h-10 max-h-[120px] sm:max-h-[150px] resize-none text-sm sm:text-base"
          rows={1}
        />
        <Button 
          type="submit" 
          disabled={!input.trim()} 
          className="shrink-0 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white h-[36px] sm:h-10 px-3 sm:px-4 text-sm sm:text-base"
        >
          Send
        </Button>
      </div>
    </form>
  );
};
