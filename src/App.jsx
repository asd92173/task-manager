import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { hasSupabaseEnv, supabase, supabaseInitError } from "./lib/supabase";

const SESSION_KEY = "task_manager_simple_session_v1";

function pad(number) {
  return String(number).padStart(2, "0");
}

function nowDateTimeLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
}

function toDateOnlyString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(dateString) {
  if (!dateString) return "未設定";
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return "未設定";
  const date = new Date(dateTimeString);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseTaskInput(text) {
  const trimmed = text.trim();
  return { title: trimmed || "未命名任務" };
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

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(value) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

async function resolveCurrentUser(session) {
  if (!supabase || !session?.username) return null;
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,display_name,role")
    .eq("username", String(session.username).trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return {
    userId: data.id,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
  };
}

export default function App() {
  const connectedUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const [session, setSession] = useState(loadSession);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(hasSupabaseEnv && supabase));
  const [errorText, setErrorText] = useState("");

  const [isRegister, setIsRegister] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [input, setInput] = useState("今天我要寫 PLC 程式，明天之前完成");
  const [plannedDate, setPlannedDate] = useState("");
  const [startDateTime, setStartDateTime] = useState(nowDateTimeLocal());
  const [viewMode, setViewMode] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingPlannedDate, setEditingPlannedDate] = useState("");

  const preview = useMemo(() => parseTaskInput(input), [input]);
  const isAdmin = session?.role === "admin";

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

  const fetchTasks = useCallback(async (currentSession = session) => {
    if (!supabase || !currentSession) {
      setTasks([]);
      return;
    }

    const query = supabase
      .from("tasks")
      .select("id,user_id,owner_name,title,planned_date,start_datetime,status,created_at")
      .order("planned_date", { ascending: true });

    const { data, error } = isAdmin ? await query : await query.eq("user_id", currentSession.userId);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setErrorText("");
    setTasks(data || []);
  }, [isAdmin, session]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (hasSupabaseEnv && supabase && session) {
        const fixedSession = await resolveCurrentUser(session);
        if (!fixedSession) {
          localStorage.removeItem(SESSION_KEY);
          if (mounted) setSession(null);
        } else {
          saveSession(fixedSession);
          if (mounted) setSession(fixedSession);
          await fetchTasks(fixedSession);
        }
      }
      if (mounted) setLoading(false);
    }

    init();
    return () => {
      mounted = false;
    };
  }, [fetchTasks, session]);

  async function doRegister() {
    if (!supabase) return;
    if (!authUsername.trim() || !authPassword.trim() || !authName.trim()) {
      setAuthMessage("請填寫帳號、密碼與人員名稱");
      return;
    }

    const username = authUsername.trim().toLowerCase();
    const { data: exists, error: checkError } = await supabase
      .from("app_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      setAuthMessage(checkError.message);
      return;
    }

    if (exists) {
      setAuthMessage("帳號已存在");
      return;
    }

    const { data, error } = await supabase
      .from("app_users")
      .insert({
        username,
        password: authPassword,
        display_name: authName.trim(),
        role: username === "admin" ? "admin" : "user",
      })
      .select("id,username,display_name,role")
      .single();

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    const nextSession = {
      userId: data.id,
      username: data.username,
      displayName: data.display_name,
      role: data.role,
    };

    saveSession(nextSession);
    setSession(nextSession);
    setAuthMessage("");
    await fetchTasks(nextSession);
  }

  async function doLogin() {
    if (!supabase) return;
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthMessage("請輸入帳號與密碼");
      return;
    }

    const username = authUsername.trim().toLowerCase();

    const { data, error } = await supabase
      .from("app_users")
      .select("id,username,display_name,role")
      .eq("username", username)
      .eq("password", authPassword)
      .maybeSingle();

    if (error || !data) {
      setAuthMessage(error?.message || "帳號或密碼錯誤");
      return;
    }

    const nextSession = {
      userId: data.id,
      username: data.username,
      displayName: data.display_name,
      role: data.role,
    };

    saveSession(nextSession);
    setSession(nextSession);
    setAuthMessage("");
    await fetchTasks(nextSession);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setTasks([]);
  }

  async function addTask() {
    if (!supabase || !session) return;
    if (!input.trim()) return;
    if (!plannedDate) {
      alert("請選擇預計完成日期");
      return;
    }

    const startDateOnly = startDateTime.slice(0, 10);
    if (plannedDate < startDateOnly) {
      alert("預計完成時間不得早於開始時間");
      return;
    }

    const fixedSession = await resolveCurrentUser(session);
    if (!fixedSession) {
      alert("登入狀態已失效，請重新登入");
      logout();
      return;
    }
    saveSession(fixedSession);
    setSession(fixedSession);

    const parsed = parseTaskInput(input);
    const { error } = await supabase.from("tasks").insert({
      user_id: fixedSession.userId,
      owner_name: fixedSession.displayName,
      title: parsed.title,
      planned_date: plannedDate,
      start_datetime: new Date(startDateTime).toISOString(),
      status: "進行中",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setInput("");
    setPlannedDate("");
    setStartDateTime(nowDateTimeLocal());
    await fetchTasks();
  }

  async function toggleStatus(task) {
    if (!supabase) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: task.status === "已完成" ? "進行中" : "已完成" })
      .eq("id", task.id);
    if (!error) await fetchTasks();
  }

  async function removeTask(taskId) {
    if (!supabase) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) await fetchTasks();
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
    if (!supabase) return;
    if (!editingTitle.trim()) {
      alert("請輸入任務標題");
      return;
    }
    if (!editingPlannedDate) {
      alert("請選擇預計完成日期");
      return;
    }

    const startDateOnly = String(task.start_datetime).slice(0, 10);
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
      await fetchTasks();
    }
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>請設定 Supabase 連線</h1>
          <p>請在環境變數填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY</p>
        </section>
      </main>
    );
  }

  if (supabaseInitError || !supabase) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>Supabase 初始化失敗</h1>
          <p>{supabaseInitError || "Supabase client 未建立"}</p>
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

  if (!session) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>{isRegister ? "申請帳號" : "登入"}</h1>
          <p>不用信箱，直接用你自建帳號密碼。</p>
          <p style={{ fontSize: 12, color: "#5d7396" }}>目前連線：{connectedUrl || "未設定"}</p>

          <input
            value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            placeholder="帳號（例如 admin）"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="密碼"
          />

          {isRegister && (
            <input
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="人員名稱"
            />
          )}

          <button type="button" onClick={isRegister ? doRegister : doLogin}>
            {isRegister ? "註冊" : "登入"}
          </button>

          <button type="button" className="ghost" onClick={() => setIsRegister((x) => !x)}>
            {isRegister ? "我已有帳號，改成登入" : "我要申請帳號"}
          </button>

          {authMessage && <p className="authMessage">{authMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero panel">
        <h1>任務管理</h1>
        <p>
          登入者：{session.displayName}（{session.username}）
        </p>
        <button type="button" className="ghost small" onClick={logout}>
          登出
        </button>
      </header>

      {errorText && (
        <section className="panel">
          <p className="authMessage">{errorText}</p>
        </section>
      )}

      <section className="panel inputPanel">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="輸入任務內容，例如：今天我要寫 PLC 程式，明天前完成"
        />

        <div className="fieldGrid">
          <label>
            開始時間（建立時自動帶入）
            <input type="datetime-local" value={startDateTime} readOnly />
          </label>
          <label>
            預計完成時間（日期）
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </label>
        </div>

        <div className="toolbar">
          <button type="button" className="ghost" onClick={() => setPlannedDate(toDateOnlyString(new Date()))}>
            設為今天
          </button>
          <button type="button" onClick={addTask}>
            新增任務
          </button>
        </div>

        <div className="preview">
          <span>解析標題：{preview.title}</span>
          <span>預計完成：{formatDate(plannedDate)}</span>
          <span>人員：{session.displayName}</span>
        </div>
      </section>

      <section className="statsGrid">
        <article className="panel stat">
          <h2>{isAdmin ? "全部任務" : "我的任務"}</h2>
          <strong>{sortedTasks.length}</strong>
        </article>
        <article className="panel stat">
          <h2>已完成</h2>
          <strong>{doneCount}</strong>
        </article>
        <article className="panel stat">
          <h2>進行中</h2>
          <strong>{sortedTasks.length - doneCount}</strong>
        </article>
      </section>

      <section className="panel listPanel">
        <div className="listHead">
          <h2>{isAdmin ? "全部任務清單" : "我的任務清單"}</h2>
          <span>
            {filteredTasks.length} / {sortedTasks.length} 筆
          </span>
        </div>

        <div className="searchBox">
          <label htmlFor="task-search">任務搜尋</label>
          <input
            id="task-search"
            className="searchInput"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="輸入關鍵字搜尋任務標題或人員名稱"
          />
        </div>

        <div className="filters">
          <button type="button" className={viewMode === "all" ? "active" : ""} onClick={() => setViewMode("all")}>
            全部
          </button>
          <button type="button" className={viewMode === "doing" ? "active" : ""} onClick={() => setViewMode("doing")}>
            進行中
          </button>
          <button type="button" className={viewMode === "done" ? "active" : ""} onClick={() => setViewMode("done")}>
            已完成
          </button>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="empty">目前沒有任務</p>
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
                        <input
                          type="date"
                          value={editingPlannedDate}
                          onChange={(e) => setEditingPlannedDate(e.target.value)}
                        />
                      </div>
                    ) : (
                      <h3>{task.title}</h3>
                    )}
                    <p>人員：{task.owner_name}</p>
                    <p>開始：{formatDateTime(task.start_datetime)}</p>
                    <p>
                      預計完成：{formatDate(task.planned_date)}
                      {dueMeta.label ? `（${dueMeta.label}）` : ""}
                    </p>
                  </div>

                  <span className={`badge ${task.status === "已完成" ? "done" : "doing"}`}>{task.status}</span>

                  <div className="actions">
                    <button type="button" onClick={() => toggleStatus(task)}>
                      {task.status === "已完成" ? "改回進行中" : "標記已完成"}
                    </button>
                    {editingId === task.id ? (
                      <>
                        <button type="button" className="secondary" onClick={() => saveEdit(task)}>
                          儲存
                        </button>
                        <button type="button" className="ghost" onClick={cancelEdit}>
                          取消
                        </button>
                      </>
                    ) : (
                      <button type="button" className="secondary" onClick={() => beginEdit(task)}>
                        編輯
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => removeTask(task.id)}>
                      刪除
                    </button>
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
