"use client";

import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { LoginPromptProvider } from "@/lib/login-prompt-context";
import { SavedPropertiesProvider } from "@/lib/saved-properties-context";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoginPromptProvider>
          <SavedPropertiesProvider>{children}</SavedPropertiesProvider>
        </LoginPromptProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
