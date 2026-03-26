import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthScreen from "./components/AuthScreen";

const AUTH_URL = "https://functions.poehali.dev/d17f85f6-519e-4598-9571-d11fb7a92696";

const queryClient = new QueryClient();

interface AuthUser {
  id: number;
  phone: string;
  name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

function AuthGate({ children }: { children: (user: AuthUser, token: string, onLogout: () => void) => React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string>("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("aura_token");
    const savedUser = localStorage.getItem("aura_user");
    if (!savedToken) { setChecking(false); return; }

    // Сразу показываем кэшированного пользователя — не ждём сеть
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);
        setChecking(false);
      } catch { /* битый кэш, продолжаем */ }
    }

    // Фоново обновляем данные с сервера
    fetch(`${AUTH_URL}?action=me`, {
      headers: { "Authorization": `Bearer ${savedToken}`, "X-Authorization": `Bearer ${savedToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setToken(savedToken);
          localStorage.setItem("aura_user", JSON.stringify(data.user));
        } else if (data.error && (data.error.includes("истекла") || data.error.includes("авторизован"))) {
          // Выходим только если сервер явно сказал что сессия невалидна
          localStorage.removeItem("aura_token");
          localStorage.removeItem("aura_user");
          setUser(null);
          setToken("");
        }
        // Иначе — оставляем кэшированного пользователя
      })
      .catch(() => { /* сетевая ошибка — остаёмся залогиненными */ })
      .finally(() => setChecking(false));
  }, []);

  const handleAuth = (u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("aura_user", JSON.stringify(u));
  };

  const handleLogout = () => {
    const t = localStorage.getItem("aura_token");
    if (t) {
      fetch(AUTH_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${t}`, "Content-Type": "application/json", "X-Authorization": `Bearer ${t}` },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => {});
      localStorage.removeItem("aura_token");
      localStorage.removeItem("aura_user");
    }
    setUser(null);
    setToken("");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-5xl gold-text tracking-wider mb-3">Aura</h1>
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <>{children(user, token, handleLogout)}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGate>
          {(user, token, onLogout) => (
            <Routes>
              <Route path="/" element={<Index currentUser={user} token={token} onLogout={onLogout} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </AuthGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;