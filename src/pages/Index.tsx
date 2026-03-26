import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const SEARCH_URL = "https://functions.poehali.dev/f1bacf56-907c-439c-bd8c-f1c762124106";
const FOLLOW_URL = "https://functions.poehali.dev/badd9677-1943-428f-bfc6-fc01277d8b87";
const CHATS_URL  = "https://functions.poehali.dev/d7fbd9ba-d019-45d0-9dbb-86755e663131";
const POSTS_URL  = "https://functions.poehali.dev/078d2408-c5d0-4c52-b51b-7a9c24b8554d";

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

interface Chat {
  chat_id: number;
  partner_id: number;
  partner_name: string;
  partner_username: string | null;
  partner_avatar: string | null;
  last_text: string | null;
  last_time: string | null;
  unread: number;
}

interface Message {
  id: number;
  sender_id: number;
  text: string;
  created_at: string;
}

type Tab = "feed" | "search" | "messages" | "profile";

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

function authHeaders(token: string) {
  return { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}

// ── Карточка поста ───────────────────────────────────────────────────────────
interface Post {
  id: number;
  text: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked: boolean;
  author: { id: number; name: string; username: string | null; avatar_url: string | null };
}

function PostCard({ post, token, onLike }: { post: Post; token: string; onLike: (id: number, liked: boolean, count: number) => void }) {
  const [likeLoading, setLikeLoading] = useState(false);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await fetch(POSTS_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "like", post_id: post.id }),
      });
      const data = await res.json();
      onLike(post.id, data.liked, data.likes_count);
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <div className="post-card animate-fade-in">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${colorForId(post.author.id)} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
            {avatarLetters(post.author.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{post.author.name}</p>
            <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        <p className="text-sm font-light leading-relaxed text-foreground/90 mb-4">{post.text}</p>
        <div className="flex items-center gap-5 pt-3 border-t border-border">
          <button
            onClick={handleLike}
            disabled={likeLoading}
            className={`flex items-center gap-1.5 text-sm transition-all ${post.liked ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"}`}
          >
            <Icon name="Heart" size={16} />
            <span>{post.likes_count}</span>
          </button>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="MessageCircle" size={16} />
            <span>{post.comments_count}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Вкладка: Лента ───────────────────────────────────────────────────────────
function FeedTab({ currentUser, token }: { currentUser: AuthUser; token: string }) {
  const initials = avatarLetters(currentUser.name);
  const [text, setText] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(`${POSTS_URL}?action=feed`, { headers: authHeaders(token) });
      const data = await res.json();
      setPosts(data.posts || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handlePublish = async () => {
    if (!text.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch(POSTS_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "create", text: text.trim() }),
      });
      if (res.ok) {
        setText("");
        setShowComposer(false);
        loadFeed();
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = (id: number, liked: boolean, count: number) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked, likes_count: count } : p));
  };

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
              <button onClick={() => { setShowComposer(false); setText(""); }} className="btn-outline-gold">
                Отмена
              </button>
              <button
                disabled={!text.trim() || publishing}
                className="btn-gold disabled:opacity-40 flex items-center gap-2"
                onClick={handlePublish}
              >
                {publishing ? <Icon name="Loader" size={14} className="animate-spin" /> : null}
                Опубликовать
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowComposer(true)} className="flex items-center gap-3 w-full text-left">
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Icon name="Loader" size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 opacity-50">
            <Icon name="Newspaper" size={28} className="text-muted-foreground" />
          </div>
          <p className="font-display text-2xl opacity-40">Лента пуста</p>
          <p className="text-sm text-muted-foreground mt-1">Подпишитесь на людей или создайте первую публикацию</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} token={token} onLike={handleLike} />
        ))
      )}
    </div>
  );
}

// ── Вкладка: Поиск ───────────────────────────────────────────────────────────
function SearchTab({
  token,
  currentUserId,
  onStartChat,
}: {
  token: string;
  currentUserId: number;
  onStartChat: (userId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [followStates, setFollowStates] = useState<Record<number, boolean>>({});
  const [followLoading, setFollowLoading] = useState<Record<number, boolean>>({});

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(q.trim())}`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка поиска");
      const users: FoundUser[] = (data.users || []).filter((u: FoundUser) => u.id !== currentUserId);
      setResults(users);
      setSearched(true);
      // Загружаем статусы подписки
      const statuses: Record<number, boolean> = {};
      await Promise.all(users.map(async (u) => {
        try {
          const r = await fetch(`${FOLLOW_URL}?action=status&target_id=${u.id}`, {
            headers: authHeaders(token),
          });
          const d = await r.json();
          statuses[u.id] = d.following ?? false;
        } catch { statuses[u.id] = false; }
      }));
      setFollowStates(statuses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [token, currentUserId]);

  const toggleFollow = async (userId: number) => {
    const isFollowing = followStates[userId];
    setFollowLoading((p) => ({ ...p, [userId]: true }));
    try {
      const res = await fetch(FOLLOW_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: isFollowing ? "unfollow" : "follow", target_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFollowStates((p) => ({ ...p, [userId]: !isFollowing }));
      setResults((prev) => prev.map((u) =>
        u.id === userId
          ? { ...u, followers_count: u.followers_count + (isFollowing ? -1 : 1) }
          : u
      ));
    } finally {
      setFollowLoading((p) => ({ ...p, [userId]: false }));
    }
  };

  return (
    <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-5">
      <h2 className="font-display text-3xl">Поиск</h2>

      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Icon name="Search" size={16} className="text-muted-foreground" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearched(false); }}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
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
          <p className="text-xs text-muted-foreground px-1">Найдено: {results.length}</p>
          {results.map((u, i) => (
            <div
              key={u.id}
              className="post-card p-4 animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${colorForId(u.id)} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
                  {avatarLetters(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.name}</p>
                  {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                  {u.bio && <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.bio}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{u.followers_count} подписчиков</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleFollow(u.id)}
                  disabled={followLoading[u.id]}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    followStates[u.id]
                      ? "bg-secondary text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      : "btn-gold"
                  } disabled:opacity-50`}
                >
                  {followLoading[u.id] ? (
                    <Icon name="Loader" size={13} className="animate-spin" />
                  ) : followStates[u.id] ? (
                    <><Icon name="UserMinus" size={13} /> Отписаться</>
                  ) : (
                    <><Icon name="UserPlus" size={13} /> Подписаться</>
                  )}
                </button>
                <button
                  onClick={() => onStartChat(u.id)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium btn-outline-gold"
                >
                  <Icon name="MessageCircle" size={13} /> Написать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4 opacity-40">
            <Icon name="Users" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Введите имя, @никнейм или номер телефона</p>
        </div>
      )}
    </div>
  );
}

// ── Вкладка: Сообщения ────────────────────────────────────────────────────────
function MessagesTab({ token, currentUserId, openChatId, onChatOpened }: {
  token: string;
  currentUserId: number;
  openChatId: number | null;
  onChatOpened: () => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch(`${CHATS_URL}?action=list`, { headers: authHeaders(token) });
      const data = await res.json();
      setChats(data.chats || []);
    } finally {
      setLoadingChats(false);
    }
  }, [token]);

  const loadMessages = useCallback(async (chatId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${CHATS_URL}?action=messages&chat_id=${chatId}`, { headers: authHeaders(token) });
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setLoadingMsgs(false);
    }
  }, [token]);

  const openChat = useCallback(async (chatId: number) => {
    const chat = chats.find((c) => c.chat_id === chatId);
    if (chat) {
      setActiveChat(chat);
      loadMessages(chatId);
    }
  }, [chats, loadMessages]);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    if (openChatId && chats.length > 0) {
      openChat(openChatId);
      onChatOpened();
    }
  }, [openChatId, chats, openChat, onChatOpened]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeChat || sending) return;
    setSending(true);
    const text = newMsg.trim();
    setNewMsg("");
    try {
      await fetch(CHATS_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "send", chat_id: activeChat.chat_id, text }),
      });
      await loadMessages(activeChat.chat_id);
      loadChats();
    } finally {
      setSending(false);
    }
  };

  const chatList = (
    <div className={`${activeChat ? "hidden md:flex" : "flex"} flex-col w-full md:w-72 border-r border-border`}>
      <div className="p-5 border-b border-border flex-shrink-0">
        <h2 className="font-display text-2xl">Сообщения</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingChats ? (
          <div className="flex items-center justify-center py-10">
            <Icon name="Loader" size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 opacity-50">
              <Icon name="MessageCircle" size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Нет диалогов</p>
            <p className="text-xs text-muted-foreground mt-1 opacity-60">Найдите пользователя и нажмите «Написать»</p>
          </div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.chat_id}
              onClick={() => openChat(chat.chat_id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors border-b border-border/50 text-left ${
                activeChat?.chat_id === chat.chat_id ? "bg-secondary" : ""
              }`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorForId(chat.partner_id)} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
                {avatarLetters(chat.partner_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{chat.partner_name}</p>
                  {chat.last_time && (
                    <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{timeAgo(chat.last_time)}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {chat.last_text || "Начните общение"}
                </p>
              </div>
              {chat.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-gold flex items-center justify-center text-[10px] font-bold text-background flex-shrink-0">
                  {chat.unread}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const chatView = activeChat ? (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveChat(null)}
          className="md:hidden text-muted-foreground hover:text-foreground transition-colors mr-1"
        >
          <Icon name="ArrowLeft" size={18} />
        </button>
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${colorForId(activeChat.partner_id)} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
          {avatarLetters(activeChat.partner_name)}
        </div>
        <div>
          <p className="font-medium text-sm">{activeChat.partner_name}</p>
          {activeChat.partner_username && (
            <p className="text-xs text-muted-foreground">@{activeChat.partner_username}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-10">
            <Icon name="Loader" size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-muted-foreground">Начните общение</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div>
                  <div className={`message-bubble ${isOwn ? "own" : "other"}`}>
                    {msg.text}
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? "text-right" : ""}`}>
                    {timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 bg-secondary rounded-2xl px-4 py-2.5">
          <input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1 bg-transparent text-sm outline-none placeholder-muted-foreground"
            placeholder="Написать сообщение..."
          />
          <button
            onClick={sendMessage}
            disabled={!newMsg.trim() || sending}
            className="text-muted-foreground hover:text-gold transition-colors disabled:opacity-30"
          >
            <Icon name={sending ? "Loader" : "Send"} size={17} className={sending ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full gold-gradient mx-auto mb-4 flex items-center justify-center opacity-30">
          <Icon name="MessageCircle" size={28} className="text-background" />
        </div>
        <p className="font-display text-2xl opacity-40">Выберите диалог</p>
        <p className="text-sm text-muted-foreground mt-1">чтобы начать общение</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 0px)" }}>
      {chatList}
      {chatView}
    </div>
  );
}

// ── Модалка редактирования профиля ───────────────────────────────────────────
function EditProfileModal({ user, token, onSave, onClose }: {
  user: AuthUser; token: string;
  onSave: (u: AuthUser) => void; onClose: () => void;
}) {
  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Введите имя"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(POSTS_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "update_profile", name: name.trim(), username: username.trim(), bio: bio.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      localStorage.setItem("aura_user", JSON.stringify(data.user));
      onSave(data.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-background rounded-3xl p-6 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Редактировать профиль</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
              className={inputCls} placeholder="Ваше имя" maxLength={100} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input type="text" value={username}
                onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                className="w-full bg-secondary rounded-xl pl-9 pr-4 py-3 text-sm outline-none placeholder-muted-foreground border border-transparent focus:border-gold/40 transition-colors font-mono"
                placeholder="username" maxLength={30} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">О себе</label>
            <textarea value={bio} onChange={(e) => { setBio(e.target.value); setError(""); }}
              className={`${inputCls} resize-none min-h-[80px]`}
              placeholder="Расскажите о себе..." maxLength={300} />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs flex items-center gap-1.5"><Icon name="AlertCircle" size={13} /> {error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-outline-gold flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Icon name="Loader" size={14} className="animate-spin" /> : null}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Вкладка: Профиль ─────────────────────────────────────────────────────────
function ProfileTab({ currentUser, token, onLogout, onUserUpdate }: {
  currentUser: AuthUser; token: string;
  onLogout: () => void; onUserUpdate: (u: AuthUser) => void;
}) {
  const [user, setUser] = useState(currentUser);
  const [showEdit, setShowEdit] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => { setUser(currentUser); }, [currentUser]);

  useEffect(() => {
    fetch(`${POSTS_URL}?action=user_posts`, { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .finally(() => setLoadingPosts(false));
  }, [token]);

  const handleSave = (u: AuthUser) => {
    setUser(u);
    onUserUpdate(u);
    setShowEdit(false);
  };

  const handleLike = (id: number, liked: boolean, count: number) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, liked, likes_count: count } : p));
  };

  const initials = avatarLetters(user.name);

  return (
    <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {showEdit && <EditProfileModal user={user} token={token} onSave={handleSave} onClose={() => setShowEdit(false)} />}

      <div className="post-card p-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center text-2xl font-semibold text-background flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-3xl">{user.name || "Пользователь"}</h2>
            {user.username && <p className="text-muted-foreground text-sm mt-0.5">@{user.username}</p>}
            {user.bio && <p className="text-sm font-light mt-2 leading-relaxed text-foreground/80">{user.bio}</p>}
            <div className="flex gap-6 mt-4">
              <div><p className="font-display text-xl">{user.posts_count}</p><p className="text-xs text-muted-foreground">публикации</p></div>
              <div><p className="font-display text-xl">{user.followers_count}</p><p className="text-xs text-muted-foreground">подписчики</p></div>
              <div><p className="font-display text-xl">{user.following_count}</p><p className="text-xs text-muted-foreground">подписки</p></div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setShowEdit(true)} className="btn-gold flex-1 text-center">Редактировать профиль</button>
          <button onClick={onLogout} className="btn-outline-gold px-3 hover:border-rose-500/50 hover:text-rose-400">
            <Icon name="LogOut" size={16} />
          </button>
        </div>
      </div>

      {loadingPosts ? (
        <div className="flex justify-center py-8"><Icon name="Loader" size={20} className="animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="post-card p-6 flex flex-col items-center text-center py-12">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 opacity-50">
            <Icon name="Grid2x2" size={20} className="text-muted-foreground" />
          </div>
          <p className="font-display text-lg opacity-40">Публикаций пока нет</p>
          <p className="text-xs text-muted-foreground mt-1">Создайте первую запись в ленте</p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} token={token} onLike={handleLike} />)
      )}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function Index({ currentUser: initialUser, token, onLogout }: IndexProps) {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [pendingOpenChatId, setPendingOpenChatId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser>(initialUser);

  useEffect(() => { setCurrentUser(initialUser); }, [initialUser]);

  const handleStartChat = async (userId: number) => {
    try {
      const res = await fetch(CHATS_URL, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "start", target_id: userId }),
      });
      const data = await res.json();
      if (data.chat_id) {
        setPendingOpenChatId(data.chat_id);
        setActiveTab("messages");
      }
    } catch { /* silent */ }
  };

  const navItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: "feed",     icon: "Home",          label: "Лента" },
    { tab: "search",   icon: "Search",        label: "Поиск" },
    { tab: "messages", icon: "MessageCircle", label: "Чаты" },
    { tab: "profile",  icon: "User",          label: "Профиль" },
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
            <button onClick={onLogout} className="ml-auto text-muted-foreground hover:text-rose-400 transition-colors">
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen pb-16 lg:pb-0 overflow-hidden">
        {activeTab === "feed" && <FeedTab currentUser={currentUser} token={token} />}
        {activeTab === "search" && (
          <SearchTab token={token} currentUserId={currentUser.id} onStartChat={handleStartChat} />
        )}
        {activeTab === "messages" && (
          <MessagesTab
            token={token}
            currentUserId={currentUser.id}
            openChatId={pendingOpenChatId}
            onChatOpened={() => setPendingOpenChatId(null)}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            currentUser={currentUser}
            token={token}
            onLogout={onLogout}
            onUserUpdate={(u) => setCurrentUser(u)}
          />
        )}
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
            <Icon name={icon} size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}