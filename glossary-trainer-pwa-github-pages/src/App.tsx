import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Upload, Download, BookOpen, Search, RotateCcw, PlayCircle, ListChecks, BarChart2, Plus, DownloadCloud } from "lucide-react";

export type Term = {
  id: string;
  term: string;
  definition: string;
  tags?: string[];
  source?: string;
  bucket: number;
  due: string;
  history: { d: string; rating: Rating }[];
};

type Rating = "again" | "hard" | "good" | "easy";
type Mode = "review" | "learn" | "browse";

const STORAGE_KEY = "econ-org-glossary-v1";
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const LEITNER_INTERVALS = [0, 1, 3, 7, 14, 30];

function scheduleNext(term: Term, rating: Rating): Term {
  let bucket = term.bucket;
  if (rating === "again") bucket = Math.max(1, bucket - 1);
  if (rating === "hard") bucket = Math.max(1, bucket);
  if (rating === "good") bucket = Math.min(5, Math.max(1, bucket + 1));
  if (rating === "easy") bucket = Math.min(5, Math.max(2, bucket + 2));
  const interval = LEITNER_INTERVALS[bucket];
  const due = addDays(todayISO(), interval);
  return { ...term, bucket, due, history: [...term.history, { d: new Date().toISOString(), rating }] };
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SEED: Term[] = [
  { id: uid(), term: "Организационная структура", definition: "Совокупность подразделений и связей между ними, определяющих распределение функций, ответственности и полномочий в компании.", tags: ["управление"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Затраты фиксированные", definition: "Издержки, величина которых не зависит от объёма выпуска в краткосрочном периоде (аренда, амортизация).", tags: ["издержки"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Затраты переменные", definition: "Издержки, изменяющиеся пропорционально объёму выпуска (сырьё, сдельная оплата труда).", tags: ["издержки"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Точка безубыточности", definition: "Объём продаж, при котором прибыль равна нулю и выручка покрывает все издержки.", tags: ["финансы"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Маржинальный доход", definition: "Разница между выручкой и переменными затратами; используется для анализа ассортимента и ценообразования.", tags: ["финансы"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Аутсорсинг", definition: "Передача вспомогательных или непрофильных функций внешним исполнителям для повышения эффективности.", tags: ["организация"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "BSC (Сбалансированная система показателей)", definition: "Методика стратегического управления, переводящая стратегию в систему целей и KPI по четырём перспективам.", tags: ["стратегия"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "KPI", definition: "Ключевые показатели эффективности, отражающие степень достижения целей.", tags: ["оценка"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Бизнес-процесс", definition: "Повторяемая последовательность действий, создающая ценность для внутреннего или внешнего клиента.", tags: ["процессы"], bucket: 0, due: todayISO(), history: [] },
  { id: uid(), term: "Реинжиниринг процессов", definition: "Фундаментальное переосмысление и радикальное перепроектирование процессов для достижения резких улучшений.", tags: ["процессы"], bucket: 0, due: todayISO(), history: [] },
];

function load(): Term[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return SEED;
  try { const parsed = JSON.parse(raw) as Term[]; return parsed.length ? parsed : SEED; } catch { return SEED; }
}
function save(data: Term[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border border-gray-200">{children}</span>
);
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-2xl shadow p-4 md:p-6 bg-white ${className || ""}`}>{children}</div>
);

export default function App() {
  const [mode, setMode] = useState<Mode>("review");
  const [all, setAll] = useState<Term[]>(load());
  const [query, setQuery] = useState("");
  const [showBack, setShowBack] = useState(false);
  const [sessionSize, setSessionSize] = useState(20);
  const [installEvent, setInstallEvent] = useState<any | null>(null);

  useEffect(() => save(all), [all]);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    console.log('PWA install:', choice);
  };

  const dueToday = useMemo(() => all.filter(t => t.bucket > 0 && t.due <= todayISO()).sort((a,b)=>a.due.localeCompare(b.due)), [all]);
  const newCards = useMemo(() => all.filter(t => t.bucket === 0), [all]);
  const progress = useMemo(() => {
    const total = all.length;
    const learned = all.filter(t => t.bucket > 0).length;
    const mastered = all.filter(t => t.bucket >= 5).length;
    return { total, learned, mastered };
  }, [all]);

  const queue = useMemo(() => {
    if (mode === "review") return dueToday.slice(0, sessionSize);
    if (mode === "learn") return newCards.slice(0, sessionSize);
    return [];
  }, [mode, dueToday, newCards, sessionSize]);

  const current = queue[0];

  const rate = (rating: Rating) => {
    if (!current) return;
    const next = all.map((t) => (t.id === current.id ? scheduleNext({ ...t, bucket: t.bucket || 1 }, rating) : t));
    setAll(next);
    setShowBack(false);
  };

  const resetProgress = () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    const reset = all.map((t) => ({ ...t, bucket: 0, due: todayISO(), history: [] }));
    setAll(reset);
    setMode("learn");
  };

  const importCSV = (csv: string) => {
    const rows = csv.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const parsed: Term[] = rows.map(r => {
      const [term, definition, tags] = r.split(/;|\t/);
      return { id: uid(), term: (term||'').trim(), definition: (definition||'').trim(), tags: tags? tags.split(',').map(s=>s.trim()): [], bucket: 0, due: todayISO(), history: [] } as Term;
    });
    if (!parsed.length) { alert("Не удалось распознать CSV"); return; }
    setAll(parsed); setMode("learn");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "econ_org_glossary.json"; a.click(); URL.revokeObjectURL(url);
  };

  const addOne = () => {
    const term = prompt("Термин"); if (!term) return;
    const definition = prompt("Определение") || "";
    const tags = (prompt("Теги (через запятую)") || "").split(",").map(s=>s.trim()).filter(Boolean);
    setAll(prev => [...prev, { id: uid(), term, definition, tags, bucket: 0, due: todayISO(), history: [] }]);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim(); if (!q) return all;
    return all.filter(t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q) || (t.tags||[]).some(x => x.toLowerCase().includes(q)));
  }, [all, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-2xl md:text-3xl font-semibold">Глоссарий: Экономика организации</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("review")} className={`px-3 py-1.5 rounded-xl border ${mode === "review" ? "bg-black text-white" : "bg-white"}`}>
              <PlayCircle className="inline w-4 h-4 mr-1" /> Повторение ({dueToday.length})
            </button>
            <button onClick={() => setMode("learn")} className={`px-3 py-1.5 rounded-xl border ${mode === "learn" ? "bg-black text-white" : "bg-white"}`}>
              <ListChecks className="inline w-4 h-4 mr-1" /> Новые ({newCards.length})
            </button>
            <button onClick={() => setMode("browse")} className={`px-3 py-1.5 rounded-xl border ${mode === "browse" ? "bg-black text-white" : "bg-white"}`}>
              <Search className="inline w-4 h-4 mr-1" /> Обзор
            </button>
            {installEvent && (
              <button onClick={triggerInstall} className="px-3 py-1.5 rounded-xl border bg-white">
                <DownloadCloud className="inline w-4 h-4 mr-1" /> Установить
              </button>
            )}
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Всего терминов</div>
                <div className="text-2xl font-semibold">{progress.total}</div>
              </div>
              <BarChart2 className="w-8 h-8" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Изучено (bucket ≥ 1)</div>
                <div className="text-2xl font-semibold">{progress.learned}</div>
              </div>
              <Pill>Due сегодня: {dueToday.length}</Pill>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Освоено (bucket ≥ 5)</div>
                <div className="text-2xl font-semibold">{progress.mastered}</div>
              </div>
              <button onClick={resetProgress} className="px-3 py-1.5 rounded-xl border bg-white"><RotateCcw className="inline w-4 h-4 mr-1"/>Сброс</button>
            </div>
          </Card>
        </div>

        {mode !== "browse" && (
          <Card className="md:col-span-3">
            {!current ? (
              <div className="text-center py-12 text-gray-500">Нет карточек в очереди. Измените режим или увеличьте размер сессии.</div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500">
                    Режим: {mode === "review" ? "Повторение" : "Новые"} • В очереди: {queue.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Сессия:</label>
                    <input type="number" className="w-20 px-2 py-1 border rounded-lg" value={sessionSize} onChange={(e) => setSessionSize(Math.max(5, Number(e.target.value) || 20))} />
                  </div>
                </div>

                <motion.div key={current.id + String(showBack)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-6 md:p-10">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(current.tags || []).map((t) => (<Pill key={t}>{t}</Pill>))}
                    <Pill>Bucket {current.bucket || 0}</Pill>
                    <Pill>Due {current.due}</Pill>
                  </div>

                  <div className="text-2xl md:text-3xl font-semibold mb-4">{current.term}</div>

                  {!showBack ? (
                    <button onClick={() => setShowBack(true)} className="px-4 py-2 rounded-xl border">Показать определение</button>
                  ) : (
                    <div>
                      <div className="text-lg md:text-xl leading-relaxed mb-6">{current.definition}</div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => rate("again")} className="px-3 py-2 rounded-xl border">Again</button>
                        <button onClick={() => rate("hard")} className="px-3 py-2 rounded-xl border">Hard</button>
                        <button onClick={() => rate("good")} className="px-3 py-2 rounded-xl border">Good</button>
                        <button onClick={() => rate("easy")} className="px-3 py-2 rounded-xl border">Easy</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </Card>
        )}

        {mode === "browse" && (
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4" />
                <input className="flex-1 border rounded-lg px-3 py-2 w-full" placeholder="Поиск по термину, определению или тегам" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setMode("learn")} className="px-3 py-1.5 rounded-xl border bg-white">Перейти к обучению</button>
                <button onClick={addOne} className="px-3 py-1.5 rounded-xl border bg-white"><Plus className="inline w-4 h-4 mr-1" /> Добавить термин</button>
              </div>
              <div className="space-y-2">
                <ImportExport importCSV={importCSV} exportJSON={exportJSON} />
              </div>
            </Card>

            <Card className="md:col-span-2">
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
                {filtered.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl border bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{t.term}</div>
                        <div className="text-sm text-gray-700 mt-1">{t.definition}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(t.tags || []).map((tg) => (<Pill key={tg}>{tg}</Pill>))}
                          <Pill>Bucket {t.bucket || 0}</Pill>
                          <Pill>Due {t.due}</Pill>
                        </div>
                      </div>
                      <button onClick={() => setAll((prev) => prev.filter((x) => x.id !== t.id))} className="p-1 rounded-lg border text-gray-500 hover:text-black" title="Удалить">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <footer className="mt-10 text-center text-sm text-gray-500">
          Сделано для обучения глоссарию по дисциплине «Экономика организации». Хранение данных — локально в браузере. Работает офлайн (PWA).
        </footer>
      </div>
    </div>
  );
}

const ImportExport: React.FC<{ importCSV: (csv: string) => void; exportJSON: () => void }> = ({ importCSV, exportJSON }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Термин;Определение;теги,через,запятую\nМаржинальная прибыль;Выручка минус переменные затраты;финансы,анализ\n...");

  return (
    <div>
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl border bg-white w-full text-left">
        <Upload className="inline w-4 h-4 mr-1" /> Импорт/Экспорт
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Импорт из CSV или TSV</div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg border"><X className="w-4 h-4"/></button>
            </div>
            <p className="text-sm text-gray-600 mb-2">Ожидаемый формат: <code>термин;определение;теги,через,запятую</code>. Можно использовать табуляцию вместо <code>;</code>.</p>
            <textarea className="w-full h-48 border rounded-xl p-3 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => importCSV(text)} className="px-3 py-2 rounded-xl border"><Upload className="inline w-4 h-4 mr-1"/>Импортировать</button>
              <button onClick={exportJSON} className="px-3 py-2 rounded-xl border"><Download className="inline w-4 h-4 mr-1"/>Экспорт JSON</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
