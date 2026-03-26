import { useState } from "react";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/d17f85f6-519e-4598-9571-d11fb7a92696";

type Mode = "login" | "register";

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

interface AuthScreenProps {
  onAuth: (user: AuthUser, token: string) => void;
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    let d = digits;
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    let result = "+7";
    if (d.length > 1) result += " (" + d.slice(1, 4);
    if (d.length >= 4) result += ") " + d.slice(4, 7);
    if (d.length >= 7) result += "-" + d.slice(7, 9);
    if (d.length >= 9) result += "-" + d.slice(9, 11);
    return result;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value.replace(/\D/g, "")));
    setError("");
  };

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) {
      setError("Введите корректный номер телефона");
      return;
    }
    if (!password || password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Введите ваше имя");
      return;
    }
    if (mode === "register" && username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setError("Username: 3–30 символов, только латиница, цифры и _");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = {
        action: mode,
        phone,
        password,
      };
      if (mode === "register") {
        body.name = name.trim();
        if (username.trim()) body.username = username.trim();
      }

      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      localStorage.setItem("aura_token", data.token);
      onAuth(data.user, data.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setPassword("");
    setName("");
    setUsername("");
  };

  const inputCls = "w-full bg-secondary rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-gold/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-gold/4 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-6xl gold-text tracking-wider">Aura</h1>
          <p className="text-muted-foreground text-xs mt-1 tracking-[0.35em] uppercase font-light">
            social network
          </p>
        </div>

        <div className="glass rounded-3xl p-8 space-y-6">
          {/* Tab switcher */}
          <div className="flex bg-secondary rounded-xl p-1">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Войти
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Зарегистрироваться
            </button>
          </div>

          <div className="space-y-3">
            {/* Phone */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="Phone" size={16} className="text-muted-foreground" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="+7 (999) 000-00-00"
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Name (register only) */}
            {mode === "register" && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Icon name="User" size={16} className="text-muted-foreground" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Ваше имя"
                  className={inputCls}
                  maxLength={50}
                />
              </div>
            )}

            {/* Username (register only) */}
            {mode === "register" && (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="username (необязательно)"
                  className="w-full bg-secondary rounded-xl pl-9 pr-4 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors font-mono"
                  maxLength={30}
                />
              </div>
            )}

            {/* Password */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="Lock" size={16} className="text-muted-foreground" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Пароль (мин. 6 символов)"
                className="w-full bg-secondary rounded-xl pl-11 pr-11 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={16} />
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <Icon name="AlertCircle" size={13} /> {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Icon name="Loader" size={16} className="animate-spin" />
              ) : mode === "login" ? (
                <>Войти <Icon name="ArrowRight" size={16} /></>
              ) : (
                <>Создать аккаунт <Icon name="Sparkles" size={16} /></>
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center font-light leading-relaxed">
            {mode === "login"
              ? "Нет аккаунта? Нажмите «Зарегистрироваться» выше"
              : "Регистрируясь, вы соглашаетесь с условиями использования Aura"}
          </p>
        </div>
      </div>
    </div>
  );
}
