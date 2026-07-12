/**
 * SAVR Chat Page - Prestigious Editorial
 * Refined AI assistant interface
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ModeToggle } from '@/components/ui/ModeToggle';

export default function Chat() {
  const location = useLocation();
  const [initialMessage, setInitialMessage] = useState<string | undefined>();

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setInitialMessage(state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <MobileLayout
      title="Assistant"
      headerRight={<ModeToggle />}
    >
      <ChatInterface
        initialMessage={initialMessage}
        className="h-full"
      />
    </MobileLayout>
  );
}
