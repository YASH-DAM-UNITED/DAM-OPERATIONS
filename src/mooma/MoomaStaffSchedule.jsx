import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Download,
  Edit3,
  LoaderCircle,
  Minus,
  Palmtree,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  UserRoundX,
  Users,
  X,
} from "lucide-react";


import { activeScroll } from "./moomaApi.js";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHIFT_OPTIONS = [
  { value: "STRAIGHT", label: "Straight Duty" },
  { value: "BREAK", label: "Break Duty" },
  { value: "OFF", label: "Day Off" },
];

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(isoDate, amount) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseHour(value) {
  const cleaned = String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();

  const match = /^(\d{1,2})(AM|PM)$/.exec(cleaned);
  if (!match) return 0;

  let hour = Number(match[1]);
  const ap = match[2];

  if (ap === "PM" && hour !== 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;

  return hour;
}

function calculateHours(start, end) {
  const s = parseHour(start);
  let e = parseHour(end);
  if (e <= s) e += 24;
  return e - s;
}

function straightShift(start, end) {
  const hours = calculateHours(start, end);
  const overtime = Math.max(0, hours - 9);

  return {
    hours,
    value:
      overtime > 0
        ? `${start} - ${end} (OT ${overtime}h)`
        : `${start} - ${end}`,
  };
}

function breakShift(d1s, d1e, d2s, d2e) {
  const hours =
    calculateHours(d1s, d1e) +
    calculateHours(d2s, d2e);

  const overtime = Math.max(0, hours - 9);
  let value = `${d1s}-${d1e}|${d2s}-${d2e}`;

  if (overtime > 0) {
    value += ` (OT ${overtime}h)`;
  }

  return { hours, value };
}

function shiftOT(value) {
  const match = /\(OT\s+(\d+(?:\.\d+)?)\s*h\)/i.exec(
    String(value || "")
  );
  return match ? Number(match[1]) || 0 : 0;
}

function employeeOT(employee) {
  return DAYS.reduce(
    (total, day) =>
      total + shiftOT(employee.shifts?.[day]),
    0
  );
}

function displayShift(value) {
  const text = String(value || "").trim();

  if (!text) {
    return { main: "NOT SET", className: "empty" };
  }

  if (text === "OFF") {
    return { main: "DAY OFF", className: "off" };
  }

  if (text === "VACATION") {
    return { main: "VACATION", className: "vacation" };
  }

  if (text.includes("|")) {
    return {
      main: "BREAK DUTY",
      detail: text,
      className: "break",
    };
  }

  return {
    main: "STRAIGHT DUTY",
    detail: text,
    className: "straight",
  };
}

function csvEscape(value) {
  const string = String(value ?? "");
  return `"${string.replace(/"/g, '""')}"`;
}

function TimePicker({
  title,
  hour,
  setHour,
  ap,
  setAP,
}) {
  return (
    <div className="bss-time-picker">
      <small>{title}</small>

      <div>
        <select
          value={hour}
          onChange={(event) =>
            setHour(Number(event.target.value))
          }
        >
          {HOURS.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          value={ap}
          onChange={(event) =>
            setAP(event.target.value)
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function ShiftModal({
  employee,
  day,
  mode,
  onClose,
  onApply,
}) {
  const [startHour, setStartHour] = useState(5);
  const [startAP, setStartAP] = useState("AM");
  const [endHour, setEndHour] = useState(5);
  const [endAP, setEndAP] = useState("PM");

  const [d1sHour, setD1sHour] = useState(1);
  const [d1sAP, setD1sAP] = useState("AM");
  const [d1eHour, setD1eHour] = useState(4);
  const [d1eAP, setD1eAP] = useState("AM");
  const [d2sHour, setD2sHour] = useState(9);
  const [d2sAP, setD2sAP] = useState("AM");
  const [d2eHour, setD2eHour] = useState(12);
  const [d2eAP, setD2eAP] = useState("PM");

  const [applyAll, setApplyAll] = useState(false);

  const preview =
    mode === "straight"
      ? straightShift(
          `${startHour}${startAP}`,
          `${endHour}${endAP}`
        )
      : breakShift(
          `${d1sHour}${d1sAP}`,
          `${d1eHour}${d1eAP}`,
          `${d2sHour}${d2sAP}`,
          `${d2eHour}${d2eAP}`
        );

  const valid = preview.hours >= 9;

  return (
    <motion.div
      className="bss-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bss-shift-modal"
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
      >
        <button
          type="button"
          className="bss-modal-x"
          onClick={onClose}
        >
          <X size={17} />
        </button>

        <div className="bss-modal-kicker">
          <Clock3 size={13} />
          {mode === "straight"
            ? "STRAIGHT DUTY"
            : "BREAK DUTY"}
        </div>

        <h2>{employee.name}</h2>
        <p>{day}</p>

        {mode === "straight" ? (
          <div className="bss-time-grid two">
            <TimePicker
              title="START"
              hour={startHour}
              setHour={setStartHour}
              ap={startAP}
              setAP={setStartAP}
            />

            <TimePicker
              title="END"
              hour={endHour}
              setHour={setEndHour}
              ap={endAP}
              setAP={setEndAP}
            />
          </div>
        ) : (
          <>
            <div className="bss-duty-label">DUTY 01</div>

            <div className="bss-time-grid two">
              <TimePicker
                title="START"
                hour={d1sHour}
                setHour={setD1sHour}
                ap={d1sAP}
                setAP={setD1sAP}
              />

              <TimePicker
                title="END"
                hour={d1eHour}
                setHour={setD1eHour}
                ap={d1eAP}
                setAP={setD1eAP}
              />
            </div>

            <div className="bss-duty-label">DUTY 02</div>

            <div className="bss-time-grid two">
              <TimePicker
                title="START"
                hour={d2sHour}
                setHour={setD2sHour}
                ap={d2sAP}
                setAP={setD2sAP}
              />

              <TimePicker
                title="END"
                hour={d2eHour}
                setHour={setD2eHour}
                ap={d2eAP}
                setAP={setD2eAP}
              />
            </div>
          </>
        )}

        <div
          className={`bss-duration ${
            valid ? "valid" : "invalid"
          }`}
        >
          <strong>{preview.hours} HOURS</strong>
          <span>
            {valid
              ? "Shift duration valid"
              : "Minimum 9 hours required"}
          </span>
        </div>

        <label className="bss-check">
          <input
            type="checkbox"
            checked={applyAll}
            onChange={(event) =>
              setApplyAll(event.target.checked)
            }
          />
          Apply to all working days this week
        </label>

        <button
          type="button"
          className="bss-modal-apply"
          disabled={!valid}
          onClick={() =>
            onApply(preview.value, applyAll)
          }
        >
          <Check size={16} />
          APPLY SHIFT
        </button>
      </motion.div>
    </motion.div>
  );
}

function AddEmployeeModal({
  roles,
  busy,
  onClose,
  onSave,
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(
    roles?.[0] || "Team-Member"
  );

  return (
    <motion.div
      className="bss-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bss-employee-modal"
        initial={{ opacity: 0, scale: 0.94, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <button
          className="bss-modal-x"
          type="button"
          onClick={onClose}
        >
          <X size={17} />
        </button>

        <div className="bss-modal-kicker">
          <UserPlus size={13} />
          NEW TEAM MEMBER
        </div>

        <h2>Add Employee</h2>

        <div className="bss-form-grid">
          <label>
            <span>EMPLOYEE ID</span>
            <input
              value={employeeId}
              placeholder="Employee ID"
              onChange={(event) =>
                setEmployeeId(event.target.value)
              }
            />
          </label>

          <label>
            <span>FULL NAME</span>
            <input
              value={name}
              placeholder="Employee name"
              onChange={(event) =>
                setName(event.target.value)
              }
            />
          </label>

          <label className="full">
            <span>ROLE</span>

            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value)
              }
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="bss-modal-apply"
          disabled={
            busy ||
            !name.trim() ||
            !role
          }
          onClick={() =>
            onSave({
              employeeId: employeeId.trim(),
              name: name.trim(),
              role,
            })
          }
        >
          {busy ? (
            <LoaderCircle
              size={16}
              className="dam-spin"
            />
          ) : (
            <UserPlus size={16} />
          )}

          ADD EMPLOYEE
        </button>
      </motion.div>
    </motion.div>
  );
}

function RemoveEmployeeModal({
  employee,
  destinations,
  busy,
  onClose,
  onVacation,
  onRemove,
}) {
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");

  const reasons = [
    {
      id: "transfer",
      title: "Transfer",
      text: "Move employee to another branch.",
      icon: BriefcaseBusiness,
    },
    {
      id: "terminated",
      title: "Terminated",
      text: "Remove employee from the active branch.",
      icon: UserRoundX,
    },
    {
      id: "vacation",
      title: "Vacation",
      text: "Keep employee and fill this week as VACATION.",
      icon: Palmtree,
    },
    {
      id: "contract_finished",
      title: "Contract Finished",
      text: "Remove from active branch and clear Employee ID.",
      icon: ShieldCheck,
    },
  ];

  return (
    <motion.div
      className="bss-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bss-remove-modal"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <button
          type="button"
          className="bss-modal-x"
          onClick={onClose}
        >
          <X size={17} />
        </button>

        <div className="bss-modal-kicker danger">
          <Trash2 size={13} />
          EMPLOYEE ACTION
        </div>

        <h2>{employee.name}</h2>

        <p className="bss-remove-question">
          Why is this employee being removed from this branch?
        </p>

        <div className="bss-reason-grid">
          {reasons.map((item) => {
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.id}
                className={
                  reason === item.id ? "active" : ""
                }
                onClick={() => setReason(item.id)}
              >
                <Icon size={18} />
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </button>
            );
          })}
        </div>

        {reason === "transfer" && (
          <label className="bss-destination-select">
            <span>DESTINATION BRANCH</span>

            <select
              value={destination}
              onChange={(event) =>
                setDestination(event.target.value)
              }
            >
              <option value="">
                Select destination...
              </option>

              {destinations.map((item) => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className={`bss-modal-apply ${
            reason === "vacation"
              ? "vacation"
              : "danger"
          }`}
          disabled={
            busy ||
            !reason ||
            (
              reason === "transfer" &&
              !destination
            )
          }
          onClick={() => {
            if (reason === "vacation") {
              onVacation();
              return;
            }

            onRemove(reason, destination);
          }}
        >
          {busy ? (
            <LoaderCircle
              size={16}
              className="dam-spin"
            />
          ) : reason === "vacation" ? (
            <Palmtree size={16} />
          ) : (
            <Trash2 size={16} />
          )}

          {reason === "vacation"
            ? "FILL THIS WEEK AS VACATION"
            : "CONFIRM EMPLOYEE ACTION"}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function MoomaStaffSchedule({
  branch,
  onBack,
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [shiftModal, setShiftModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [removeModal, setRemoveModal] = useState(null);
  const [success, setSuccess] = useState(null);
  const [message, setMessage] = useState(null);
  const boardRef = useRef(null);
  const messageRef = useRef(null);

  async function loadSchedule(force = false) {
    if (!branch?.code) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/mooma/schedule/init?branch=${encodeURIComponent(
          branch.code
        )}&date=${encodeURIComponent(
          selectedDate
        )}${force ? "&refresh=1" : ""}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Unable to load staff schedule."
        );
      }

      setData(result);

      setEmployees(
        (result.employees || []).map((employee) => ({
          ...employee,
          shifts: {
            ...employee.shifts,
          },
        }))
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to load schedule."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedule(false);
  }, [branch?.code, selectedDate]);


  useEffect(() => {
    if (message) {
      activeScroll(messageRef, "center");
    }
  }, [message]);

  useEffect(() => {
    if (!loading && employees.length) {
      // Keeps the active schedule in view after add/refresh operations.
      window.requestAnimationFrame(() => {});
    }
  }, [employees.length, loading]);

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) =>
      `${employee.employeeId} ${employee.name} ${employee.role}`
        .toLowerCase()
        .includes(query)
    );
  }, [employees, search]);

  function updateShift(employeeKey, day, value) {
    setEmployees((current) =>
      current.map((employee) => {
        const key =
          employee.employeeId ||
          employee.name;

        if (key !== employeeKey) {
          return employee;
        }

        return {
          ...employee,
          shifts: {
            ...employee.shifts,
            [day]: value,
          },
        };
      })
    );
  }

  function applyShiftModal(value, applyAll) {
    if (!shiftModal) return;

    const employeeKey =
      shiftModal.employee.employeeId ||
      shiftModal.employee.name;

    if (applyAll) {
      setEmployees((current) =>
        current.map((employee) => {
          const key =
            employee.employeeId ||
            employee.name;

          if (key !== employeeKey) {
            return employee;
          }

          const shifts = {
            ...employee.shifts,
          };

          DAYS.forEach((day) => {
            shifts[day] = value;
          });

          return {
            ...employee,
            shifts,
          };
        })
      );
    } else {
      updateShift(
        employeeKey,
        shiftModal.day,
        value
      );
    }

    setShiftModal(null);
  }

  function chooseShift(employee, day, selected) {
    const employeeKey =
      employee.employeeId ||
      employee.name;

    if (selected === "OFF") {
      updateShift(employeeKey, day, "OFF");
      return;
    }

    if (selected === "STRAIGHT") {
      setShiftModal({
        employee,
        day,
        mode: "straight",
      });
      return;
    }

    if (selected === "BREAK") {
      setShiftModal({
        employee,
        day,
        mode: "break",
      });
    }
  }

  function clearAllShifts() {
    const confirmed =
      window.confirm(
        "Clear every shift currently prepared for this week?"
      );

    if (!confirmed) return;

    setEmployees((current) =>
      current.map((employee) => ({
        ...employee,
        shifts: Object.fromEntries(
          DAYS.map((day) => [day, ""])
        ),
      }))
    );
  }

  async function submitSchedule() {
    if (busy) return;

    if (data?.submitted) {
      setMessage({
        type: "error",
        text:
          "This week's schedule has already been submitted for this branch.",
      });

      return;
    }

    try {
      setBusy(true);
      setMessage(null);

      const response = await fetch(
        "/api/mooma/schedule/submit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            branchCode: branch.code,
            selectedDate,
            employees: employees.map((employee) => ({
              employeeId:
                employee.employeeId,
              name:
                employee.name,
              role:
                employee.role,
              shifts:
                employee.shifts,
            })),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Schedule submission failed."
        );
      }

      setSuccess(result);

      await loadSchedule(true);
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.message ||
          "Schedule submission failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function addEmployee(employee) {
    try {
      setBusy(true);

      const response = await fetch(
        "/api/mooma/schedule/employee/add",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            branchCode: branch.code,
            ...employee,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Unable to add employee."
        );
      }

      setAddModal(false);

      setMessage({
        type: "success",
        text: result.message,
      });

      await loadSchedule(true);
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.message ||
          "Unable to add employee.",
      });
    } finally {
      setBusy(false);
    }
  }

  function vacationEmployee(employee) {
    const key =
      employee.employeeId ||
      employee.name;

    setEmployees((current) =>
      current.map((item) => {
        const itemKey =
          item.employeeId ||
          item.name;

        if (itemKey !== key) {
          return item;
        }

        return {
          ...item,
          shifts: Object.fromEntries(
            DAYS.map((day) => [
              day,
              "VACATION",
            ])
          ),
        };
      })
    );

    setRemoveModal(null);
    setEditMode(true);

    setMessage({
      type: "success",
      text:
        `${employee.name} has been filled as VACATION for this week. Submit the schedule to save it to Google Sheets.`,
    });
  }

  async function removeEmployee(reason, destination) {
    if (!removeModal) return;

    try {
      setBusy(true);

      const response = await fetch(
        "/api/mooma/schedule/employee/remove",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            branchCode: branch.code,
            employeeId:
              removeModal.employeeId,
            name:
              removeModal.name,
            reason,
            destinationBranch:
              destination,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          "Employee action failed."
        );
      }

      setRemoveModal(null);

      setMessage({
        type: "success",
        text: result.message,
      });

      await loadSchedule(true);
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.message ||
          "Employee action failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  function downloadCSV() {
    if (!data) return;

    const headers = [
      "Employee ID",
      "Name",
      "Role",
      ...DAYS.map(
        (day) =>
          data.week?.dayLabels?.[day] ||
          day
      ),
      data.week?.otHeader || "Over-Time",
    ];

    const lines = [
      headers.map(csvEscape).join(","),
    ];

    employees.forEach((employee) => {
      lines.push(
        [
          employee.employeeId,
          employee.name,
          employee.role,
          ...DAYS.map(
            (day) =>
              employee.shifts?.[day] ||
              ""
          ),
          `${employeeOT(employee)} hrs`,
        ]
          .map(csvEscape)
          .join(",")
      );
    });

    const blob = new Blob(
      [lines.join("\n")],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = href;
    link.download =
      `Schedule_${branch.code}_${data.week?.weekStartISO || selectedDate}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  if (loading && !data) {
    return (
      <div className="bss-page">
        <div className="bss-loading">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 2.2,
              ease: "linear",
            }}
          >
            <CalendarDays size={50} />
          </motion.div>

          <span>MOOMA STAFF NETWORK</span>
          <h2>Building the week.</h2>
          <p>Loading staff and schedule data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bss-page">
      <div className="bss-grid-bg" />
      <div className="bss-glow one" />
      <div className="bss-glow two" />

      <header className="bss-header">
        <button
          type="button"
          className="bss-back"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          STAFF DASHBOARD
        </button>

        <div className="bss-brand">
          <div>
            <Coffee size={17} />
          </div>

          <span>
            <strong>MOOMA</strong>
            STAFF SCHEDULE
          </span>
        </div>

        <div className="bss-head-actions">
          <button
            type="button"
            onClick={() => loadSchedule(true)}
            disabled={loading || busy}
          >
            <RefreshCcw size={15} />
            REFRESH
          </button>

          <button
            type="button"
            onClick={downloadCSV}
          >
            <Download size={15} />
            CSV
          </button>
        </div>
      </header>

      <main className="bss-main">
        <section className="bss-hero">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bss-kicker">
              <Sparkles size={12} />
              MOOMA / PEOPLE OPERATIONS
            </div>

            <h1>
              Shape the
              <br />
              <span>week.</span>
            </h1>

            <p>
              Build branch shifts, control overtime and manage employee movement from one operational schedule.
            </p>
          </motion.div>

          <motion.div
            className="bss-branch-card"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <small>ACTIVE BRANCH</small>
            <h2>{branch.name}</h2>
            <strong>{branch.code}</strong>

            <div>
              <Users size={14} />
              {employees.length} TEAM MEMBERS
            </div>
          </motion.div>
        </section>

        <section className="bss-week-control">
          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(selectedDate, -7)
              )
            }
          >
            <ChevronLeft size={17} />
          </button>

          <label>
            <small>SELECT DATE</small>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(event.target.value)
              }
            />
          </label>

          <div className="bss-week-display">
            <small>WEEK STARTING</small>
            <strong>
              {data?.week?.weekStartDisplay}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(selectedDate, 7)
              )
            }
          >
            <ChevronRight size={17} />
          </button>
        </section>

        <AnimatePresence>
          {message && (
            <motion.div
              ref={messageRef} className={`bss-message ${message.type}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {message.type === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertTriangle size={16} />
              )}

              <span>{message.text}</span>

              <button
                type="button"
                onClick={() => setMessage(null)}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="bss-message error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <section className="bss-toolbar">
          <div className="bss-search">
            <Search size={15} />

            <input
              value={search}
              placeholder="Search staff, role or employee ID..."
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="bss-toolbar-actions">
            <button
              type="button"
              className={editMode ? "active" : ""}
              onClick={() =>
                setEditMode((value) => !value)
              }
            >
              <Edit3 size={15} />
              {editMode ? "EDITING" : "EDIT MODE"}
            </button>

            <button
              type="button"
              onClick={() => setAddModal(true)}
            >
              <UserPlus size={15} />
              ADD EMPLOYEE
            </button>

            {editMode && (
              <button
                type="button"
                className="muted"
                onClick={clearAllShifts}
              >
                <Minus size={15} />
                CLEAR SHIFTS
              </button>
            )}
          </div>
        </section>

        {data?.submitted && (
          <section className="bss-submitted-banner">
            <ShieldCheck size={18} />

            <div>
              <strong>WEEK LOCKED</strong>
              <span>
                This branch already has submitted schedule data for this week. Duplicate submission is blocked.
              </span>
            </div>
          </section>
        )}

        <section ref={boardRef} className="bss-board-shell">
          <div className="bss-board-meta">
            <div>
              <span>STAFF SCHEDULE</span>
              <h2>{data?.week?.weekStartDisplay}</h2>
            </div>

            <strong>
              {visibleEmployees.length} / {employees.length} STAFF
            </strong>
          </div>

          <div className="bss-board-scroll">
            <table className="bss-board">
              <thead>
                <tr>
                  <th className="sticky staff">
                    EMPLOYEE
                  </th>

                  <th className="role">
                    ROLE
                  </th>

                  {DAYS.map((day) => (
                    <th key={day}>
                      <strong>{day.slice(0, 3)}</strong>
                      <small>
                        {data?.week
                          ?.dayLabels?.[day]
                          ?.match(/\((.*?)\)/)?.[1] ||
                          ""}
                      </small>
                    </th>
                  ))}

                  <th className="ot">OT</th>
                  <th className="actions">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {visibleEmployees.map((employee) => {
                  const key =
                    employee.employeeId ||
                    employee.name;

                  return (
                    <tr key={key}>
                      <td className="sticky staff">
                        <div className="bss-employee-cell">
                          <div>
                            <UserRound size={16} />
                          </div>

                          <span>
                            <strong>{employee.name}</strong>
                            <small>
                              {employee.employeeId ||
                                "NO EMPLOYEE ID"}
                            </small>
                          </span>
                        </div>
                      </td>

                      <td className="role">
                        {editMode && !data?.submitted ? (
                          <select
                            value={employee.role}
                            onChange={(event) =>
                              setEmployees((current) =>
                                current.map((item) =>
                                  (
                                    item.employeeId ||
                                    item.name
                                  ) === key
                                    ? {
                                        ...item,
                                        role:
                                          event.target
                                            .value,
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            {data?.roles?.map((role) => (
                              <option
                                key={role}
                                value={role}
                              >
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="bss-role-pill">
                            {employee.role}
                          </span>
                        )}
                      </td>

                      {DAYS.map((day) => {
                        const info =
                          displayShift(
                            employee.shifts?.[day]
                          );

                        return (
                          <td
                            key={day}
                            className="shift"
                          >
                            {editMode &&
                            !data?.submitted ? (
                              <div className="bss-shift-editor">
                                <select
                                  value=""
                                  onChange={(event) =>
                                    chooseShift(
                                      employee,
                                      day,
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="">
                                    SET SHIFT
                                  </option>

                                  {SHIFT_OPTIONS.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className={`bss-shift-chip ${info.className}`}
                                  onClick={() => {
                                    if (
                                      info.className ===
                                      "straight"
                                    ) {
                                      setShiftModal({
                                        employee,
                                        day,
                                        mode:
                                          "straight",
                                      });
                                    } else if (
                                      info.className ===
                                      "break"
                                    ) {
                                      setShiftModal({
                                        employee,
                                        day,
                                        mode:
                                          "break",
                                      });
                                    }
                                  }}
                                >
                                  <strong>{info.main}</strong>

                                  {info.detail && (
                                    <small>
                                      {info.detail}
                                    </small>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div
                                className={`bss-shift-chip ${info.className}`}
                              >
                                <strong>{info.main}</strong>

                                {info.detail && (
                                  <small>
                                    {info.detail}
                                  </small>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="ot">
                        <strong className="bss-ot">
                          {employeeOT(employee)}h
                        </strong>
                      </td>

                      <td className="actions">
                        <button
                          type="button"
                          className="bss-remove-employee"
                          onClick={() =>
                            setRemoveModal(employee)
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleEmployees.length === 0 && (
            <div className="bss-empty">
              No staff found.
            </div>
          )}
        </section>

        {editMode && !data?.submitted && (
          <motion.section
            className="bss-submit-bar"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <small>WEEKLY SUBMISSION</small>
              <strong>
                {employees.length} employees ready
              </strong>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={submitSchedule}
            >
              {busy ? (
                <LoaderCircle
                  size={17}
                  className="dam-spin"
                />
              ) : (
                <Save size={17} />
              )}

              SUBMIT MASTER SCHEDULE
            </button>
          </motion.section>
        )}
      </main>

      <AnimatePresence>
        {shiftModal && (
          <ShiftModal
            employee={shiftModal.employee}
            day={shiftModal.day}
            mode={shiftModal.mode}
            onClose={() => setShiftModal(null)}
            onApply={applyShiftModal}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addModal && (
          <AddEmployeeModal
            roles={data?.roles || []}
            busy={busy}
            onClose={() => setAddModal(false)}
            onSave={addEmployee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {removeModal && (
          <RemoveEmployeeModal
            employee={removeModal}
            destinations={data?.destinations || []}
            busy={busy}
            onClose={() => setRemoveModal(null)}
            onVacation={() =>
              vacationEmployee(removeModal)
            }
            onRemove={removeEmployee}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {success && (
          <motion.div
            className="bss-success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bss-success-card"
              initial={{
                opacity: 0,
                scale: 0.8,
                y: 35,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
            >
              <div>
                <CheckCircle2 size={52} />
              </div>

              <span>MASTER SCHEDULE UPDATED</span>
              <h2>Week submitted.</h2>
              <p>{success.weekStartDisplay}</p>

              <button
                type="button"
                onClick={() => {
                  setSuccess(null);
                  setEditMode(false);
                }}
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
