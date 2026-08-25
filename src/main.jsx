import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const LECTURES_PER_DAY = 7;

const number = (value) => Number(value);

function pct(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(2)}%`;
}

/*
  Source of truth: the formulas supplied by the user.

  Current:
    percentage = present / (present + absent) * 100

  Skip:
    new_percentage = present / (present + absent + skipped) * 100
    drop = current_percentage - new_percentage

  Target:
    n = (target * total - 100 * present) / (100 - target)
    lectures = ceil(n)
    days = ceil(lectures / 7)
*/

function calculateCurrent(present, absent) {
  const total = present + absent;
  if (total === 0) throw new Error("Total lectures cannot be zero.");
  return {
    percentage: round((present / total) * 100),
    total,
  };
}

function calculateSkip(present, absent, skipLectures, skipDays) {
  const current = calculateCurrent(present, absent);

  const skipped = skipLectures + skipDays * LECTURES_PER_DAY;

  // State immediately after skipping
  const newPresent = present;
  const newAbsent = absent + skipped;
  const newTotal = newPresent + newAbsent;

  const newPercentage = round((newPresent / newTotal) * 100);

  const drop = round(current.percentage - newPercentage);

  // Find the minimum number of future lectures needed
  // to return to the original attendance percentage.
  let recoveryLectures = 0;

  if (newPercentage < current.percentage) {
    const required =
      (current.percentage * newTotal - 100 * newPresent) /
      (100 - current.percentage);

    recoveryLectures = Math.ceil(required);
  }

  const recoveryDays = Math.ceil(recoveryLectures / LECTURES_PER_DAY);

  return {
    currentPercentage: current.percentage,
    skipped,
    newPercentage,
    drop,
    recoveryLectures,
    recoveryDays,
  };
}

function calculateTarget(present, absent, target) {
  const current = calculateCurrent(present, absent);

  if (target >= 100) {
    if (current.percentage === 100) {
      return {
        lecturesNeeded: 0,
        daysNeeded: 0,
        note: "Already at 100%.",
      };
    }
    return {
      lecturesNeeded: null,
      daysNeeded: null,
      note: "100% is impossible once you've missed even one lecture.",
    };
  }

  const n =
    (target * current.total - 100 * present) /
    (100 - target);

  if (n <= 0) {
    return {
      lecturesNeeded: 0,
      daysNeeded: 0,
      note: `Already at/above ${target}% (current: ${current.percentage}%).`,
    };
  }

  const lecturesNeeded = Math.ceil(n);
  return {
    lecturesNeeded,
    daysNeeded: Math.ceil(lecturesNeeded / LECTURES_PER_DAY),
    note: null,
  };
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateBase(presentRaw, absentRaw) {
  if (presentRaw === "" || absentRaw === "") {
    return "Enter both present and absent lectures.";
  }

  const present = number(presentRaw);
  const absent = number(absentRaw);

  if (!Number.isInteger(present) || !Number.isInteger(absent)) {
    return "Present and absent lectures must be whole numbers.";
  }

  if (present < 0 || absent < 0) {
    return "Present and absent lectures cannot be negative.";
  }

  if (present + absent === 0) {
    return "Total lectures cannot be zero.";
  }

  return null;
}

function App() {
  const [present, setPresent] = useState("148");
  const [absent, setAbsent] = useState("14");
  const [mode, setMode] = useState("lectures");
  const [skipValue, setSkipValue] = useState("3");
  const [target, setTarget] = useState("90");
  const [active, setActive] = useState("current");
  const [error, setError] = useState("");

  const base = useMemo(() => {
    const message = validateBase(present, absent);
    if (message) return { error: message };
    try {
      return { data: calculateCurrent(number(present), number(absent)) };
    } catch (e) {
      return { error: e.message };
    }
  }, [present, absent]);

  const skipResult = useMemo(() => {
    if (base.error) return null;
    const value = number(skipValue);
    if (
      skipValue === "" ||
      !Number.isInteger(value) ||
      value < 0
    ) return null;

    return calculateSkip(
      number(present),
      number(absent),
      mode === "lectures" ? value : 0,
      mode === "days" ? value : 0
    );
  }, [base, present, absent, skipValue, mode]);

  const targetResult = useMemo(() => {
    if (base.error) return null;
    const value = number(target);
    if (target === "" || !Number.isFinite(value) || value < 0 || value > 100) {
      return null;
    }
    return calculateTarget(number(present), number(absent), value);
  }, [base, present, absent, target]);

  function changeField(setter, value) {
    setter(value);
    setError("");
  }

  function reset() {
    setPresent("");
    setAbsent("");
    setMode("lectures");
    setSkipValue("3");
    setTarget("90");
    setActive("current");
    setError("");
  }

  function chooseTab(tab) {
    setActive(tab);
    setError("");
  }

  function validateSkip() {
    if (base.error) return setError(base.error);
    const value = number(skipValue);
    if (
      skipValue === "" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return setError(
        `Skipped ${mode} must be a non-negative whole number.`
      );
    }
    setError("");
  }

  function validateTarget() {
    if (base.error) return setError(base.error);
    const value = number(target);
    if (
      target === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      return setError("Target percentage must be between 0 and 100.");
    }
    setError("");
  }

  const displayedError = error || (base.error && active !== "current" ? base.error : "");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <span>Attendance Calculator</span>
        </div>
        <div className="privacy">
          <span className="privacy-dot" />
          Calculated locally
        </div>
      </header>

      <main className="container">
        <section className="intro">
          <div className="kicker">STUDENT UTILITY</div>
          <h1>Know your attendance<br /><em>before you skip.</em></h1>
          <p>
            A simple calculator for checking your current percentage,
            predicting a drop, and planning how to reach your target.
          </p>
        </section>

        <section className="workspace">
          <aside className="panel inputs-panel">
            <div className="panel-heading">
              <div>
                <h2>Your numbers</h2>
                <p>Use the values from your college ERP.</p>
              </div>
              <button className="reset-btn" onClick={reset}>Reset</button>
            </div>

            <div className="input-grid">
              <Field
                label="Present lectures"
                value={present}
                setValue={(v) => changeField(setPresent, v)}
              />
              <Field
                label="Absent lectures"
                value={absent}
                setValue={(v) => changeField(setAbsent, v)}
              />
            </div>

            <div className="summary">
              <div>
                <span>Total lectures</span>
                <strong>{base.data?.total ?? "—"}</strong>
              </div>
              <div className="summary-line" />
              <div>
                <span>Current attendance</span>
                <strong className="summary-accent">
                  {base.data ? pct(base.data.percentage) : "—"}
                </strong>
              </div>
            </div>

            {displayedError && (
              <div className="error" role="alert">
                <span className="error-icon">!</span>
                <span>{displayedError}</span>
              </div>
            )}
          </aside>

          <section className="panel calculator-panel">
            <nav className="tabs" aria-label="Calculator modes">
              <button className={active === "current" ? "active" : ""} onClick={() => chooseTab("current")}>
                Current
              </button>
              <button className={active === "skip" ? "active" : ""} onClick={() => chooseTab("skip")}>
                If I skip
              </button>
              <button className={active === "target" ? "active" : ""} onClick={() => chooseTab("target")}>
                Reach target
              </button>
            </nav>

            {active === "current" && (
              <CurrentView
                data={base.data}
                error={base.error}
              />
            )}

            {active === "skip" && (
              <SkipView
                mode={mode}
                setMode={setMode}
                value={skipValue}
                setValue={(v) => changeField(setSkipValue, v)}
                result={skipResult}
                error={base.error}
                onCalculate={validateSkip}
              />
            )}

            {active === "target" && (
              <TargetView
                target={target}
                setTarget={(v) => changeField(setTarget, v)}
                result={targetResult}
                error={base.error}
                onCalculate={validateTarget}
              />
            )}
          </section>
        </section>

        <footer>
          <span>7 lectures per day</span>
          <span>•</span>
          <span>No data is stored</span>
          <span>•</span>
          <span>Works entirely in your browser</span>
        </footer>
      </main>
    </div>
  );
}

function CurrentView({ data, error }) {
  if (error) {
    return (
      <EmptyState
        title="Enter your attendance"
        text="Add your present and absent lecture counts to calculate your current percentage."
      />
    );
  }

  return (
    <div className="view">
      <div className="view-label">CURRENT ATTENDANCE</div>
      <div className="big-number">{pct(data.percentage)}</div>
      <div className="progress">
        <div style={{ width: `${Math.min(data.percentage, 100)}%` }} />
      </div>
      <div className="result-caption">
        {data.total} total lectures · {Math.round(data.percentage / 100 * data.total)} present
      </div>

      <div className="formula">
        <span>Present</span>
        <b>÷</b>
        <span>Total lectures</span>
        <b>×</b>
        <span>100</span>
      </div>
    </div>
  );
}

function SkipView({ mode, setMode, value, setValue, result, error, onCalculate }) {
  return (
    <div className="view">
      <div className="view-label">PREDICT A DROP</div>
      <h2 className="question">What happens if you skip?</h2>
      <p className="view-text">
        Every skipped lecture becomes an additional absence.
      </p>

      <div className="segmented">
        <button
          className={mode === "lectures" ? "selected" : ""}
          onClick={() => setMode("lectures")}
        >
          Lectures
        </button>
        <button
          className={mode === "days" ? "selected" : ""}
          onClick={() => setMode("days")}
        >
          Days
        </button>
      </div>

      <Field
        label={mode === "lectures" ? "Lectures to skip" : "Days to skip"}
        value={value}
        setValue={setValue}
        compact
      />

      <button className="primary-btn" onClick={onCalculate}>
        Calculate impact
      </button>

      {error && <InlineError text={error} />}

      {result && !error && (
        <>
          <div className="result-grid">
            <Metric label="Current" value={pct(result.currentPercentage)} />

            <Metric
              label="After skipping"
              value={pct(result.newPercentage)}
              danger
            />

            <Metric
              label="Drop"
              value={`${result.drop.toFixed(2)} pts`}
              danger
            />

            <Metric label="Lectures missed" value={result.skipped} />
          </div>

          <div className="recovery-box">
            <div className="recovery-heading">
              <span>RECOVERY</span>
              <strong>Get back to {pct(result.currentPercentage)}</strong>
            </div>

            <div className="recovery-values">
              <div>
                <span>Lectures to attend</span>
                <strong>{result.recoveryLectures}</strong>
              </div>

              <div>
                <span>Full days</span>
                <strong>{result.recoveryDays}</strong>
              </div>
            </div>

            <p>
              Attend these lectures consecutively to return to your original
              attendance percentage.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function TargetView({ target, setTarget, result, error, onCalculate }) {
  return (
    <div className="view">
      <div className="view-label">RECOVERY PLAN</div>
      <h2 className="question">How much do I need?</h2>
      <p className="view-text">
        Find the minimum number of lectures you must attend to reach your target.
      </p>

      <Field
        label="Target attendance"
        value={target}
        setValue={setTarget}
        suffix="%"
        compact
      />

      <button className="primary-btn" onClick={onCalculate}>Calculate requirement</button>

      {error && <InlineError text={error} />}

      {result && !error && (
        result.note ? (
          <div className="notice">{result.note}</div>
        ) : (
          <div className="recovery">
            <div>
              <span>Lectures to attend</span>
              <strong>{result.lecturesNeeded}</strong>
            </div>
            <div>
              <span>Full days</span>
              <strong>{result.daysNeeded}</strong>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Field({ label, value, setValue, suffix, compact = false }) {
  return (
    <label className={`field ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
        />
        {suffix && <b>{suffix}</b>}
      </div>
    </label>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div className={`metric ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <div className="empty-mark">%</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function InlineError({ text }) {
  return <div className="inline-error"><span>!</span>{text}</div>;
}

createRoot(document.getElementById("root")).render(<App />);
