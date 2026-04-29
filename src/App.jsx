import { useMemo, useState } from "react";
import "./App.css";

const USERS_KEY = "talk-task-users-v1";
const SESSION_KEY = "talk-task-session-v1";
const TASKS_KEY = "talk-task-manager-v2";

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
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
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
  const suggestedDate = parseDate(text);
  const title = extractTitle(text) || text.trim();
  return { title, suggestedDate };
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function App() {
  const [users, setUsers] = useState(() => loadJson(USERS_KEY, []));
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null));
  const [tasks, setTasks] = useState(() => loadJson(TASKS_KEY, []));

  const [isRegister, setIsRegister] = useState(false);
  const [authAccount, setAuthAccount] = useState("");
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

  const currentUser = session || null;
  const isAdmin = currentUser?.role === "admin";
  const userTasks = useMemo(() => {
    const ownedTasks = isAdmin
      ? tasks
      : tasks.filter((task) => task.ownerAccount === currentUser?.account);
    return [...ownedTasks].sort((a, b) => {
      if (!a.plannedDate && !b.plannedDate) return 0;
      if (!a.plannedDate) return 1;
      if (!b.plannedDate) return -1;
      return a.plannedDate.localeCompare(b.plannedDate);
    });
  }, [tasks, isAdmin, currentUser?.account]);
  const doneCount = userTasks.filter((task) => task.status === "已完成").length;
  const preview = useMemo(() => parseTaskInput(input), [input]);
  const filteredTasks = useMemo(() => {
    let result = userTasks;
    if (viewMode === "doing") result = result.filter((task) => task.status === "進行中");
    if (viewMode === "done") result = result.filter((task) => task.status === "已完成");
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(keyword) ||
          task.ownerName.toLowerCase().includes(keyword),
      );
    }
    return result;
  }, [userTasks, viewMode, searchKeyword]);

  function upsertUsers(nextUsers) {
    setUsers(nextUsers);
    saveJson(USERS_KEY, nextUsers);
  }

  function upsertTasks(nextTasks) {
    setTasks(nextTasks);
    saveJson(TASKS_KEY, nextTasks);
  }

  function doRegister() {
    if (!authAccount.trim() || !authPassword.trim() || !authName.trim()) {
      setAuthMessage("請填寫帳號、密碼、人員名稱");
      return;
    }

    if (users.some((item) => item.account === authAccount.trim())) {
      setAuthMessage("此帳號已存在");
      return;
    }

    const nextUsers = [
      ...users,
      { account: authAccount.trim(), password: authPassword, name: authName.trim() },
    ];

    upsertUsers(nextUsers);
    const nextSession = { account: authAccount.trim(), name: authName.trim(), role: "user" };
    setSession(nextSession);
    saveJson(SESSION_KEY, nextSession);
    setAuthMessage("註冊成功，已登入");
    setAuthPassword("");
  }

  function doLogin() {
    if (authAccount.trim() === "admin" && authPassword === "admin") {
      const adminSession = { account: "admin", name: "管理員", role: "admin" };
      setSession(adminSession);
      saveJson(SESSION_KEY, adminSession);
      setAuthMessage("管理員登入成功");
      setAuthPassword("");
      return;
    }

    const matched = users.find(
      (item) => item.account === authAccount.trim() && item.password === authPassword,
    );

    if (!matched) {
      setAuthMessage("帳號或密碼錯誤");
      return;
    }

    const nextSession = { account: matched.account, name: matched.name, role: "user" };
    setSession(nextSession);
    saveJson(SESSION_KEY, nextSession);
    setAuthMessage("登入成功");
    setAuthPassword("");
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  }

  function addTask() {
    if (!currentUser) return;
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
    const nextTasks = [
      {
        id: crypto.randomUUID(),
        title: parsed.title,
        plannedDate,
        startDateTime,
        status: "進行中",
        ownerName: currentUser.name,
        ownerAccount: currentUser.account,
      },
      ...tasks,
    ];

    upsertTasks(nextTasks);
    setInput("");
    setPlannedDate("");
    setStartDateTime(nowDateTimeLocal());
  }

  function fillPlannedDateByText() {
    if (preview.suggestedDate) {
      setPlannedDate(preview.suggestedDate);
    }
  }

  function toggleStatus(taskId) {
    upsertTasks(
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === "已完成" ? "進行中" : "已完成" }
          : task,
      ),
    );
  }

  function removeTask(taskId) {
    upsertTasks(tasks.filter((task) => task.id !== taskId));
  }

  function beginEdit(task) {
    setEditingId(task.id);
    setEditingTitle(task.title);
    setEditingPlannedDate(task.plannedDate || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
    setEditingPlannedDate("");
  }

  function saveEdit(taskId, taskStartDateTime) {
    if (!editingTitle.trim()) {
      alert("標題不能空白");
      return;
    }
    if (!editingPlannedDate) {
      alert("請選擇預計完成時間");
      return;
    }
    const startDateOnly = taskStartDateTime.slice(0, 10);
    if (editingPlannedDate < startDateOnly) {
      alert("預計完成時間不得早於開始時間");
      return;
    }

    upsertTasks(
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, title: editingTitle.trim(), plannedDate: editingPlannedDate }
          : task,
      ),
    );
    cancelEdit();
  }

  if (!currentUser) {
    return (
      <main className="page authPage">
        <section className="panel authPanel">
          <h1>{isRegister ? "申請帳號" : "登入"}</h1>
          <p>先登入才能建立任務，任務會記錄人員名稱。</p>

          <input
            value={authAccount}
            onChange={(event) => setAuthAccount(event.target.value)}
            placeholder="帳號"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="密碼"
          />

          {isRegister && (
            <input
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              placeholder="人員名稱（例如：王小明）"
            />
          )}

          <button type="button" onClick={isRegister ? doRegister : doLogin}>
            {isRegister ? "註冊並登入" : "登入"}
          </button>

          <button type="button" className="ghost" onClick={() => setIsRegister((prev) => !prev)}>
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
          登入者：{currentUser.name}（{currentUser.account}）
          {isAdmin ? "・管理員模式" : ""}
        </p>
        <button type="button" className="ghost small" onClick={logout}>
          登出
        </button>
      </header>

      <section className="panel inputPanel">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="輸入你的任務內容與截止時間"
        />

        <div className="fieldGrid">
          <label>
            開始時間（建立時自動帶入）
            <input type="datetime-local" value={startDateTime} readOnly />
          </label>
          <label>
            預計完成時間（必填）
            <input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} required />
          </label>
        </div>

        <div className="toolbar">
          <button type="button" className="ghost" onClick={fillPlannedDateByText}>
            套用口語日期
          </button>
          <button type="button" onClick={addTask}>
            新增任務
          </button>
        </div>

        <div className="preview">
          <span>預覽任務：{preview.title || "未解析"}</span>
          <span>口語日期建議：{formatDate(preview.suggestedDate)}</span>
          <span>已選預計完成：{formatDate(plannedDate)}</span>
          <span>人員：{currentUser.name}</span>
        </div>
      </section>

      <section className="statsGrid">
        <article className="panel stat">
          <h2>{isAdmin ? "全部任務" : "我的總任務"}</h2>
          <strong>{userTasks.length}</strong>
        </article>
        <article className="panel stat">
          <h2>已完成</h2>
          <strong>{doneCount}</strong>
        </article>
        <article className="panel stat">
          <h2>進行中</h2>
          <strong>{userTasks.length - doneCount}</strong>
        </article>
      </section>

      <section className="panel listPanel">
        <div className="listHead">
          <h2>{isAdmin ? "全部任務清單" : "我的任務清單"}</h2>
          <span>{filteredTasks.length} / {userTasks.length} 筆</span>
        </div>
        <input
          className="searchInput"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder="搜尋任務關鍵字或人員名稱"
        />
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
          <p className="empty">目前沒有任務，先新增一筆。</p>
        ) : (
          <div className="list">
            {filteredTasks.map((task) => (
              (() => {
                const today = nowDateTimeLocal().slice(0, 10);
                const tomorrowDate = new Date();
                tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                const tomorrow = toDateOnlyString(tomorrowDate);
                const isLate = task.status !== "已完成" && task.plannedDate && task.plannedDate < today;
                const isDueToday = task.status !== "已完成" && task.plannedDate === today;
                const isDueTomorrow = task.status !== "已完成" && task.plannedDate === tomorrow;
                const dueClass = isLate ? "late" : isDueToday ? "today" : isDueTomorrow ? "tomorrow" : "";
                const dueText = isLate ? "已逾期" : isDueToday ? "今天到期" : isDueTomorrow ? "明天到期" : "";
                return (
              <article
                key={task.id}
                className={`taskItem ${dueClass}`}
              >
                <div className="taskMain">
                  {editingId === task.id ? (
                    <div className="editFields">
                      <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} />
                      <input
                        type="date"
                        value={editingPlannedDate}
                        onChange={(event) => setEditingPlannedDate(event.target.value)}
                      />
                    </div>
                  ) : (
                    <h3>{task.title}</h3>
                  )}
                  <p>人員：{task.ownerName}</p>
                  <p>開始時間：{formatDateTime(task.startDateTime)}</p>
                  <p>
                    預計完成：{formatDate(task.plannedDate)}
                    {dueText ? `（${dueText}）` : ""}
                  </p>
                </div>

                <span className={`badge ${task.status === "已完成" ? "done" : "doing"}`}>
                  {task.status}
                </span>

                <div className="actions">
                  <button type="button" onClick={() => toggleStatus(task.id)}>
                    {task.status === "已完成" ? "改為進行中" : "標示完成"}
                  </button>
                  {editingId === task.id ? (
                    <>
                      <button type="button" className="secondary" onClick={() => saveEdit(task.id, task.startDateTime)}>
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
              })()
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
