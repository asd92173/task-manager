import { useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "talk-task-manager-v1";

const WEEKDAY_MAP = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatDate(dateString) {
  if (!dateString) return "未設定";
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function toDateOnlyString(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
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
  if (text.includes("本週末") || text.includes("這週末")) {
    const offset = (6 - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + offset);
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
    .replace(/今天|明天|後天|本週末|這週末|下週|下周|週|周|前|之前|完成|要|我要|我今天|在|前完成/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTaskInput(text) {
  const deadline = parseDate(text);
  const title = extractTitle(text) || text.trim();
  return { title, deadline };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export default function App() {
  const [input, setInput] = useState("今天我要寫 PLC 程式，週五前完成");
  const [owner, setOwner] = useState("未指派");
  const [tasks, setTasks] = useState(loadTasks);

  const preview = useMemo(() => parseTaskInput(input), [input]);
  const doneCount = tasks.filter((task) => task.status === "已完成").length;

  function upsertTasks(nextTasks) {
    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  function addTask() {
    if (!input.trim()) return;
    const parsed = parseTaskInput(input);

    const nextTasks = [
      {
        id: crypto.randomUUID(),
        title: parsed.title,
        owner: owner.trim() || "未指派",
        deadline: parsed.deadline,
        status: "進行中",
      },
      ...tasks,
    ];

    upsertTasks(nextTasks);
    setInput("");
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

  return (
    <main className="page">
      <header className="hero">
        <h1>口語任務板</h1>
        <p>像聊天一樣輸入，例如「今天我要寫 PLC 程式，週五前完成」。</p>
      </header>

      <section className="panel inputPanel">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="輸入你的任務內容與截止時間"
        />

        <div className="toolbar">
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="負責人（可選）"
          />
          <button type="button" onClick={addTask}>
            新增任務
          </button>
        </div>

        <div className="preview">
          <span>預覽任務：{preview.title || "未解析"}</span>
          <span>截止：{formatDate(preview.deadline)}</span>
        </div>
      </section>

      <section className="statsGrid">
        <article className="panel stat">
          <h2>總任務</h2>
          <strong>{tasks.length}</strong>
        </article>
        <article className="panel stat">
          <h2>已完成</h2>
          <strong>{doneCount}</strong>
        </article>
        <article className="panel stat">
          <h2>進行中</h2>
          <strong>{tasks.length - doneCount}</strong>
        </article>
      </section>

      <section className="panel listPanel">
        <div className="listHead">
          <h2>任務清單</h2>
          <span>{tasks.length} 筆</span>
        </div>

        {tasks.length === 0 ? (
          <p className="empty">目前沒有任務，先新增一筆。</p>
        ) : (
          <div className="list">
            {tasks.map((task) => (
              <article key={task.id} className="taskItem">
                <div className="taskMain">
                  <h3>{task.title}</h3>
                  <p>
                    負責人：{task.owner} ・ 截止：{formatDate(task.deadline)}
                  </p>
                </div>

                <span className={`badge ${task.status === "已完成" ? "done" : "doing"}`}>
                  {task.status}
                </span>

                <div className="actions">
                  <button type="button" onClick={() => toggleStatus(task.id)}>
                    {task.status === "已完成" ? "改為進行中" : "標示完成"}
                  </button>
                  <button type="button" className="danger" onClick={() => removeTask(task.id)}>
                    刪除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
