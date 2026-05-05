import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { hasSupabaseEnv, supabase } from "./lib/supabase";

const WEEKDAY_MAP = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatDate(dateString) {
  if (!dateString) return "未設定";
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return "未設定";
  const date = new Date(dateTimeString);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowDateTimeLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toDateOnlyString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseWeekday(text, now) {
  const match = text.match(/(?:下)?(?:週|周)([一二三四五六日天])/);
  if (!match) return null;
  const targetDay = WEEKDAY_MAP[match[1]];
  if (targetDay === undefined) return null;

  const result = cloneDate(now);
  const currentDay = result.getDay();
  let offset = (targetDay - currentDay + 7) % 7;
  const isNextWeek = text.includes("下週") || text.includes("下周");
  if (offset === 0 || isNextWeek) offset += 7;
  result.setDate(result.getDate() + offset);
  return result;
}

function parseDate(text) {
  const now = new Date();
  const base = cloneDate(now);

  if (text.includes("今天")) return toDateOnlyString(base);
  if (text.includes("明天")) {
    base.setDate(base.getDate() + 1);
    return toDateOnlyString(base);
  }
  if (text.includes("後天")) {
    base.setDate(base.getDate() + 2);
    return toDateOnlyString(base);
  }

  const weekdayDate = parseWeekday(text, now);
  if (weekdayDate) return toDateOnlyString(weekdayDate);

  const fullDateMatch = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return toDateOnlyString(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  const monthDayMatch = text.match(/(\d{1,2})[\/-](\d{1,2})/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    return toDateOnlyString(new Date(now.getFullYear(), Number(month) - 1, Number(day)));
  }

  return null;
}

function extractTitle(text) {
  return text
    .replace(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/g, "")
    .replace(/(\d{1,2})[\/-](\d{1,2})/g, "")
    .replace(/今天|明天|後天|下週|下周|週|周|前|之前|完成|要|我要|我今天|在|前完成/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTaskInput(text) {
  return { title: extractTitle(text) || text.trim(), suggestedDate: parseDate(text) };
}

function getDueMeta(task) {
  const today = toDateOnlyString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toDateOnlyString(tomorrowDate);

  if (task.status !== "已完成" && task.planned_date && task.planned_date < today) {
    return { className: "late", label: "已逾期" };
  }
  if (task.status !== "已完成" && task.planned_date === today) {
    return { className: "today", label: "今天到期" };
  }
  if (task.status !== "已完成" && task.planned_date === tomorrow) {
    return { className: "tomorrow", label: "明天到期" };
  }
  return { className: "", label: "" };
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function toAuthEmail(username) {
  if (username === "admin") return "admin@admin.com";
  return `${normalizeUsername(username)}@app.local`;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadTick, setLoadTick] = useState(0);

  const [isRegister, setIsRegister] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [input, setInput] = useState("今天我要寫 PLC 程式，週五前完成");
  const [plannedDate, setPlannedDate] = useState("");
  const [startDateTime, setStartDateTime] = useState(nowDateTimeLocal());
  const [viewMode, setViewMode] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingPlannedDate, setEditingPlannedDate] = useState("");

  const preview = useMemo(() => parseTaskInput(input), [input]);
  const isAdmin = profile?.role === "admin";

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.planned_date || "").localeCompare(b.planned_date || "")),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    let result = sortedTasks;
    if (viewMode === "doing") result = result.filter((task) => task.status === "進行中");
    if (viewMode === "done") result = result.filter((task) => task.status === "已完成");
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(keyword) || task.owner_name.toLowerCase().includes(keyword),
      );
    }
    return result;
  }, [sortedTasks, viewMode, searchKeyword]);

  const doneCount = sortedTasks.filter((task) => task.status === "已完成").length;

  async function fetchProfileAndTasks(userSession) {
    if (!supabase || !userSession?.user) return;

    const userId = userSession.user.id;
    const email = userSession.user.email || "";

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id,email,display_name,role")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (!existingProfile) {
      const displayName = userSession.user.user_metadata?.display_name || email.split("@")[0] || "使用者";
      const { error: insertProfileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        display_name: displayName,
        role: email === "admin@admin.com" ? "admin" : "user",
      });
      if (insertProfileError) throw insertProfileError;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,display_name,role")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;

    setProfile(profileData);

    const taskQuery = supabase
      .from("tasks")
      .select("id,user_id,owner_name,title,planned_date,start_datetime,status,created_at")
      .order("planned_date", { ascending: true });

    const { data: taskData, error: taskError } =
      profileData.role === "admin" ? await taskQuery : await taskQuery.eq("user_id", userId);

    if (taskError) throw taskError;
    setTasks(taskData || []);
  }

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("session_timeout")), 2500),
    );

    Promise.race([supabase.auth.getSession(), timeoutPromise])
      .then(async (result) => {
        if (!mounted) return;
        const data = result?.data;
        setSession(data?.session || null);
        if (data?.session) {
          await fetchProfileAndTasks(data.session);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setTasks([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      try {
        setLoadError("");
        setSession(newSession || null);
        if (newSession) {
          await fetchProfileAndTasks(newSession);
        } else {
          setProfile(null);
          setTasks([]);
        }
      } catch (error) {
        setLoadError(error?.message || "載入資料失敗");
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadTick]);

  async function doRegister() {
    if (!supabase) return;
    const username = normalizeUsername(authUsername);
    if (!username || !authPassword.trim() || !authName.trim()) {
      setAuthMessage("請填寫帳號、密碼、人員名稱");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setAuthMessage("帳號需為 3-20 字，限英文小寫/數字/底線");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: toAuthEmail(username),
      password: authPassword,
      options: { data: { display_name: authName.trim() } },
    });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("註冊成功，請直接登入");
    setIsRegister(false);
    setAuthPassword("");
  }

  async function doLogin() {
    if (!supabase) return;

    const { error } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(normalizeUsername(authUsername)),
      password: authPassword,
    });

    if (error) {
      setAuthMessage("帳號或密碼錯誤");
      return;
    }

    setAuthMessage("");
    setAuthPassword("");
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function addTask() {
    if (!supabase || !session || !profile) return;
    if (!input.trim()) return;
    if (!plannedDate) {
      alert("請先選擇預計完成時間");
      return;
    }

    const startDateOnly = startDateTime.slice(0, 10);
    if (plannedDate < startDateOnly) {
      alert("預計完成時間不得早於開始時間");
      return;
    }

    const parsed = parseTaskInput(input);
    const { error } = await supabase.from("tasks").insert({
      user_id: session.user.id,
      owner_name: profile.display_name,
      title: parsed.title,
      planned_date: plannedDate,
      start_datetime: new Date(startDateTime).toISOString(),
      status: "進行中",
    });

    if (error) {
      alert(`新增失敗：${error.message}`);
      return;
    }

    setInput("");
    setPlannedDate("");
    setStartDateTime(nowDateTimeLocal());
    await fetchProfileAndTasks(session);
  }

  function fillPlannedDateByText() {
    if (preview.suggestedDate) setPlannedDate(preview.suggestedDate);
  }

  async function toggleStatus(task) {
    if (!supabase || !session) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: task.status === "已完成" ? "進行中" : "已完成" })
      .eq("id", task.id);

    if (!error) await fetchProfileAndTasks(session);
  }

  async function removeTask(taskId) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) await fetchProfileAndTasks(session);
  }

  function beginEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
    setEditingPlannedDate(task.planned_date || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
    setEditingPlannedDate("");
  }

  async function saveEdit(task) {
    if (!supabase || !session) return;
    if (!editingTitle.trim()) {
      alert("標題不能空白");
      return;
    }
    if (!editingPlannedDate) {
      alert("請選擇預計完成時間");
      return;
    }

    const startDateOnly = task.start_datetime.slice(0, 10);
    if (editingPlannedDate < startDateOnly) {
      alert("預計完成時間不得早於開始時間");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ title: editingTitle.trim(), planned_date: editingPlannedDate })
      .eq("id", task.id);

    if (!error) {
      cancelEdit();
      await fetchProfileAndTasks(session);
    }
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>需要 Supabase 設定</h1>
          <p>請填入 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>載入中...</h1>
        </section>
      </main>
    );
  }

  if (!session || !profile) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>{isRegister ? "申請帳號" : "登入"}</h1>
          <p>不需要信箱，直接用帳號密碼。</p>

          <input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="帳號（例如 worker01）" />
          <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="密碼" />

          {isRegister && <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="人員名稱" />}

          <button type="button" onClick={isRegister ? doRegister : doLogin}>{isRegister ? "註冊" : "登入"}</button>
          <button type="button" className="ghost" onClick={() => setIsRegister((x) => !x)}>
            {isRegister ? "我已有帳號，改成登入" : "沒有帳號，申請一個"}
          </button>

          {authMessage && <p className="authMessage">{authMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero panel">
        <h1>口語任務板</h1>
        <p>
          登入者：{profile.display_name}（{profile.email === "admin@admin.com" ? "admin" : profile.email.replace("@app.local", "")})
          {isAdmin ? "・管理員模式" : ""}
        </p>
        <button type="button" className="ghost small" onClick={logout}>登出</button>
      </header>

      <section className="panel inputPanel">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="輸入你的任務內容與截止時間" />

        <div className="fieldGrid">
          <label>開始時間（建立時自動帶入）<input type="datetime-local" value={startDateTime} readOnly /></label>
          <label>預計完成時間（必填）<input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} required /></label>
        </div>

        <div className="toolbar">
          <button type="button" className="ghost" onClick={fillPlannedDateByText}>套用口語日期</button>
          <button type="button" onClick={addTask}>新增任務</button>
        </div>

        <div className="preview">
          <span>預覽任務：{preview.title || "未解析"}</span>
          <span>口語日期建議：{formatDate(preview.suggestedDate)}</span>
          <span>已選預計完成：{formatDate(plannedDate)}</span>
          <span>人員：{profile.display_name}</span>
        </div>
      </section>

      <section className="statsGrid">
        <article className="panel stat"><h2>{isAdmin ? "全部任務" : "我的總任務"}</h2><strong>{sortedTasks.length}</strong></article>
        <article className="panel stat"><h2>已完成</h2><strong>{doneCount}</strong></article>
        <article className="panel stat"><h2>進行中</h2><strong>{sortedTasks.length - doneCount}</strong></article>
      </section>

      <section className="panel listPanel">
        <div className="listHead"><h2>{isAdmin ? "全部任務清單" : "我的任務清單"}</h2><span>{filteredTasks.length} / {sortedTasks.length} 筆</span></div>

        <div className="searchBox">
          <label htmlFor="task-search">任務搜尋</label>
          <input id="task-search" className="searchInput" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="輸入關鍵字（任務標題 / 人員名稱）" />
        </div>

        <div className="filters">
          <button type="button" className={viewMode === "all" ? "active" : ""} onClick={() => setViewMode("all")}>全部</button>
          <button type="button" className={viewMode === "doing" ? "active" : ""} onClick={() => setViewMode("doing")}>進行中</button>
          <button type="button" className={viewMode === "done" ? "active" : ""} onClick={() => setViewMode("done")}>已完成</button>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="empty">目前沒有任務，先新增一筆。</p>
        ) : (
          <div className="list">
            {filteredTasks.map((task) => {
              const dueMeta = getDueMeta(task);
              return (
                <article key={task.id} className={`taskItem ${dueMeta.className}`}>
                  <div className="taskMain">
                    {editingId === task.id ? (
                      <div className="editFields">
                        <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                        <input type="date" value={editingPlannedDate} onChange={(e) => setEditingPlannedDate(e.target.value)} />
                      </div>
                    ) : (
                      <h3>{task.title}</h3>
                    )}
                    <p>人員：{task.owner_name}</p>
                    <p>開始時間：{formatDateTime(task.start_datetime)}</p>
                    <p>預計完成：{formatDate(task.planned_date)}{dueMeta.label ? `（${dueMeta.label}）` : ""}</p>
                  </div>

                  <span className={`badge ${task.status === "已完成" ? "done" : "doing"}`}>{task.status}</span>

                  <div className="actions">
                    <button type="button" onClick={() => toggleStatus(task)}>{task.status === "已完成" ? "改為進行中" : "標示完成"}</button>
                    {editingId === task.id ? (
                      <>
                        <button type="button" className="secondary" onClick={() => saveEdit(task)}>儲存</button>
                        <button type="button" className="ghost" onClick={cancelEdit}>取消</button>
                      </>
                    ) : (
                      <button type="button" className="secondary" onClick={() => beginEdit(task)}>編輯</button>
                    )}
                    <button type="button" className="danger" onClick={() => removeTask(task.id)}>刪除</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
