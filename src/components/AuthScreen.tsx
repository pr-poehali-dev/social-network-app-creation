import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/d17f85f6-519e-4598-9571-d11fb7a92696";

type Step = "phone" | "code" | "register";

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
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

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
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    setPhone(formatPhone(digits));
    setError("");
  };

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) {
      setError("Введите корректный номер телефона");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_URL}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setIsNewUser(data.is_new_user);
      setDevCode(data.dev_code || "");
      setStep("code");
      setResendSeconds(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);
    setError("");
    if (val && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (next.every((c) => c !== "")) {
      handleVerify(next.join(""));
    }
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr || code.join("");
    if (fullCode.length < 6) {
      setError("Введите 6-значный код");
      return;
    }
    if (isNewUser && step !== "register") {
      setStep("register");
      return;
    }
    await doVerify(fullCode);
  };

  const doVerify = async (codeStr: string, nameVal?: string, usernameVal?: string) => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = { phone, code: codeStr };
      if (nameVal) body.name = nameVal;
      if (usernameVal) body.username = usernameVal;

      const res = await fetch(`${AUTH_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка верификации");
      localStorage.setItem("aura_token", data.token);
      onAuth(data.user, data.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
      if (step === "code") setCode(["", "", "", "", "", ""]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setError("Введите ваше имя");
      return;
    }
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setError("Username: 3–30 символов, только латиница, цифры и _");
      return;
    }
    await doVerify(code.join(""), name.trim(), username.trim() || undefined);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background decoration */}
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

          {/* ── STEP: phone ── */}
          {step === "phone" && (
            <>
              <div>
                <h2 className="font-display text-2xl mb-1">Войти или зарегистрироваться</h2>
                <p className="text-muted-foreground text-sm font-light">
                  Введите номер телефона — отправим код подтверждения
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Icon name="Phone" size={16} className="text-muted-foreground" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full bg-secondary rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <Icon name="AlertCircle" size={13} /> {error}
                  </p>
                )}

                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <Icon name="Loader" size={16} className="animate-spin" />
                  ) : (
                    <>Получить код <Icon name="ArrowRight" size={16} /></>
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center font-light leading-relaxed">
                Нажимая «Получить код», вы соглашаетесь с условиями использования Aura
              </p>
            </>
          )}

          {/* ── STEP: code ── */}
          {step === "code" && (
            <>
              <div>
                <button
                  onClick={() => { setStep("phone"); setCode(["", "", "", "", "", ""]); setError(""); }}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
                >
                  <Icon name="ArrowLeft" size={15} /> Изменить номер
                </button>
                <h2 className="font-display text-2xl mb-1">Код подтверждения</h2>
                <p className="text-muted-foreground text-sm font-light">
                  Отправили SMS на <span className="text-foreground font-normal">{phone}</span>
                </p>
              </div>

              {devCode && (
                <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Icon name="Info" size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-xs font-light">
                    Тест-режим: код <span className="font-mono font-semibold">{devCode}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 justify-center">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { codeRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                    className={`w-11 h-13 text-center text-xl font-display bg-secondary rounded-xl border transition-all outline-none
                      ${digit ? "border-gold/60 text-gold" : "border-transparent text-foreground"}
                      focus:border-gold/50`}
                    style={{ height: "52px" }}
                  />
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-xs flex items-center gap-1.5 justify-center">
                  <Icon name="AlertCircle" size={13} /> {error}
                </p>
              )}

              <button
                onClick={() => handleVerify()}
                disabled={loading || code.some((c) => !c)}
                className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Icon name="Loader" size={16} className="animate-spin" /> : "Подтвердить"}
              </button>

              <div className="text-center">
                {resendSeconds > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Отправить повторно через {resendSeconds} с
                  </p>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    className="text-xs gold-text hover:opacity-80 transition-opacity"
                  >
                    Отправить код повторно
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── STEP: register ── */}
          {step === "register" && (
            <>
              <div>
                <button
                  onClick={() => { setStep("code"); setError(""); }}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
                >
                  <Icon name="ArrowLeft" size={15} /> Назад
                </button>
                <h2 className="font-display text-2xl mb-1">Создать профиль</h2>
                <p className="text-muted-foreground text-sm font-light">
                  Как вас зовут?
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Icon name="User" size={16} className="text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    placeholder="Ваше имя"
                    className="w-full bg-secondary rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors"
                    autoFocus
                    maxLength={50}
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    placeholder="username (необязательно)"
                    className="w-full bg-secondary rounded-xl pl-9 pr-4 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors font-mono"
                    maxLength={30}
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <Icon name="AlertCircle" size={13} /> {error}
                  </p>
                )}

                <button
                  onClick={handleRegister}
                  disabled={loading || !name.trim()}
                  className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <Icon name="Loader" size={16} className="animate-spin" />
                  ) : (
                    <>Войти в Aura <Icon name="Sparkles" size={16} /></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
