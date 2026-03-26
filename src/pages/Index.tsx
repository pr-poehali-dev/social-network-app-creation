import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

const SEARCH_URL = "https://functions.poehali.dev/f1bacf56-907c-439c-bd8c-f1c762124106";

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

interface IndexProps {
  currentUser: AuthUser;
  token: string;
  onLogout: () => void;
}

interface FoundUser {
  id: number;
  name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

type Tab = "feed" | "search" | "profile";

function avatarLetters(name: string) {
  const parts = (name || "??").trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (name || "??").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "from-rose-800 to-amber-700",
  "from-indigo-800 to-purple-700",
  "from-emerald-800 to-teal-700",
  "from-amber-800 to-orange-700",
  "from-sky-800 to-blue-700",
];

function colorForId(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// ── Вкладка: Лента ───────────────────────────────────────────────────────────
function FeedTab({ currentUser }: { currentUser: AuthUser }) {
  const initials = avatarLetters(currentUser.name);
  const [text, setText] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
      {/* Composer */}
      <div className="post-card p-4">
        {showComposer ? (
          <div className="space-y-3 animate-fade-in">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background flex-shrink-0">
                {initials}
              </div>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Поделитесь чем-то особенным..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none resize-none min-h-[80px] font-light leading-relaxed pt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => { setShowComposer(false); setText(""); }}
                className="btn-outline-gold"
              >
                Отмена
              </button>
              <button
                disabled={!text.trim()}
                className="btn-gold disabled:opacity-40"
                onClick={() => { setText(""); setShowComposer(false); }}
              >
                Опубликовать
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background flex-shrink-0">
              {initials}
            </div>
            <span className="text-muted-foreground text-sm font-light">
              Что происходит, {(currentUser.name || "").split(" ")[0] || ""}?
            </span>
            <Icon name="PenLine" size={15} className="ml-auto text-muted-foreground/50" />
          </button>
        )}
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 opacity-50">
          <Icon name="Newspaper" size={28} className="text-muted-foreground" />
        </div>
        <p className="font-display text-2xl opacity-40">Лента пуста</p>
        <p className="text-sm text-muted-foreground mt-1">
          Подпишитесь на людей, чтобы видеть их публикации
        </p>
        <p className="text-xs text-muted-foreground mt-1 opacity-60">
          или создайте первую публикацию выше
        </p>
      </div>
    </div>
  );
}

// ── Вкладка: Поиск ───────────────────────────────────────────────────────────
function SearchTab({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const base = SEARCH_URL;
      if (!base) { setError("Поиск временно недоступен"); return; }
      const res = await fetch(`${base}?q=${encodeURIComponent(q.trim())}`, {
        headers: { "X-Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка поиска");
      setResults(data.users || []);
      setSearched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch(query);
  };

  return (
    <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-5">
      <h2 className="font-display text-3xl">Поиск</h2>

      {/* Search input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Icon name="Search" size={16} className="text-muted-foreground" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearched(false); }}
          onKeyDown={handleKey}
          placeholder="Имя, @никнейм или номер телефона"
          className="w-full bg-secondary rounded-xl pl-11 pr-24 py-3.5 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors"
          autoFocus
        />
        <button
          onClick={() => doSearch(query)}
          disabled={loading || query.trim().length < 2}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-gold py-1.5 px-3 text-xs disabled:opacity-40"
        >
          {loading ? <Icon name="Loader" size={14} className="animate-spin" /> : "Найти"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <Icon name="AlertCircle" size={14} /> {error}
        </p>
      )}

      {/* Results */}
      {searched && results.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4 opacity-50">
            <Icon name="UserX" size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl opacity-40">Никого не найдено</p>
          <p className="text-sm text-muted-foreground mt-1">Попробуйте другой запрос</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            Найдено: {results.length}
          </p>
          {results.map((u, i) => (
            <div
              key={u.id}
              className="post-card p-4 flex items-center gap-4 animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colorForId(u.id)} flex items-center justify-center text-white text-base font-semibold flex-shrink-0`}>
                {avatarLetters(u.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{u.name}</p>
                {u.username && (
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                )}
                {u.bio && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.bio}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{u.followers_count} подписчиков</span>
                  <span>{u.posts_count} публ.</span>
                </div>
              </div>
              <button className="btn-outline-gold text-xs px-3 py-1.5 flex-shrink-0">
                Подписаться
              </button>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4 opacity-40">
            <Icon name="Users" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Введите имя, @никнейм или номер телефона
          </p>
        </div>
      )}
    </div>
  );
}

// ── Вкладка: Профиль ─────────────────────────────────────────────────────────
function ProfileTab({ currentUser, onLogout }: { currentUser: AuthUser; onLogout: () => void }) {
  const initials = avatarLetters(currentUser.name);

  return (
    <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-5 animate-fade-in">
      <div className="post-card p-6">
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center text-2xl font-semibold text-background">
              {initials}
            </div>
            <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center">
              <Icon name="Camera" size={12} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-3xl">{currentUser.name || "Пользователь"}</h2>
            {currentUser.username && (
              <p className="text-muted-foreground text-sm mt-0.5">@{currentUser.username}</p>
            )}
            {currentUser.bio && (
              <p className="text-sm font-light mt-2 leading-relaxed text-foreground/80">
                {currentUser.bio}
              </p>
            )}
            <div className="flex gap-6 mt-4">
              <div>
                <p className="font-display text-xl">{currentUser.posts_count}</p>
                <p className="text-xs text-muted-foreground">публикации</p>
              </div>
              <div>
                <p className="font-display text-xl">{currentUser.followers_count}</p>
                <p className="text-xs text-muted-foreground">подписчики</p>
              </div>
              <div>
                <p className="font-display text-xl">{currentUser.following_count}</p>
                <p className="text-xs text-muted-foreground">подписки</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="btn-gold flex-1 text-center">Редактировать профиль</button>
          <button
            onClick={onLogout}
            title="Выйти"
            className="btn-outline-gold px-3 hover:border-rose-500/50 hover:text-rose-400"
          >
            <Icon name="LogOut" size={16} />
          </button>
        </div>
      </div>

      {/* Empty posts state */}
      <div className="post-card p-6 flex flex-col items-center text-center py-12">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 opacity-50">
          <Icon name="Grid2x2" size={20} className="text-muted-foreground" />
        </div>
        <p className="font-display text-lg opacity-40">Публикаций пока нет</p>
        <p className="text-xs text-muted-foreground mt-1">Создайте первую запись в ленте</p>
      </div>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function Index({ currentUser, token, onLogout }: IndexProps) {
  const [activeTab, setActiveTab] = useState<Tab>("feed");

  const navItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: "feed", icon: "Home", label: "Лента" },
    { tab: "search", icon: "Search", label: "Поиск" },
    { tab: "profile", icon: "User", label: "Профиль" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border px-4 py-6 fixed h-full">
        <div className="mb-8 px-2">
          <h1 className="font-display text-3xl gold-text tracking-wider">Aura</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon name={icon} size={20} />
              {label}
            </button>
          ))}
        </nav>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background">
              {avatarLetters(currentUser.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name || "Пользователь"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentUser.username ? `@${currentUser.username}` : currentUser.phone}
              </p>
            </div>
            <button
              onClick={onLogout}
              title="Выйти"
              className="ml-auto text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {activeTab === "feed" && <FeedTab currentUser={currentUser} />}
        {activeTab === "search" && <SearchTab token={token} />}
        {activeTab === "profile" && <ProfileTab currentUser={currentUser} onLogout={onLogout} />}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border flex z-40">
        {navItems.map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === tab ? "text-gold" : "text-muted-foreground"
            }`}
          >
            <Icon name={icon} size={22} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}