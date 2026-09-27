// ============================================================
// TASK MANAGER
// Version 1.0.4
// Complete Application
// ============================================================

import {
  auth,
  db
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";


// ============================================================
// VERSION
// ============================================================

const VERSION = "1.0.4";


// ============================================================
// SECONDARY FIREBASE APP
// Used for creating students without logging admin out
// ============================================================

let secondaryApp = null;
let secondaryAuth = null;

try {

  const secondaryName = "TaskManagerSecondary";

  const firebaseConfig = {
    apiKey: "AIzaSyDFgxlX2eJ5nFVY7fQXllQG2YNTGe3lIE",
    authDomain: "task-manager-d203c.firebaseapp.com",
    projectId: "task-manager-d203c",
    storageBucket: "task-manager-d203c.firebasestorage.app",
    messagingSenderId: "1018005160470",
    appId: "1:1018005160470:web:32cbbdbc0f7cf65df9eb37"
  };

  const existing =
    getApps().find(
      app => app.name === secondaryName
    );

  secondaryApp =
    existing ||
    initializeApp(
      firebaseConfig,
      secondaryName
    );

  secondaryAuth =
    getAuth(secondaryApp);

} catch (error) {

  console.error(
    "Secondary Firebase initialization error:",
    error
  );

}


// ============================================================
// STATE
// ============================================================

const state = {

  user: null,

  profile: null,

  users: [],

  tasks: [],

  currentPage: "dashboard",

  selectedStudentId: null,

  loading: false

};


// ============================================================
// HELPERS
// ============================================================

function $(id) {
  return document.getElementById(id);
}


function show(id) {

  const element = $(id);

  if (element) {
    element.classList.remove("hidden");
  }

}


function hide(id) {

  const element = $(id);

  if (element) {
    element.classList.add("hidden");
  }

}


function message(
  id,
  text,
  type = "error"
) {

  const element = $(id);

  if (!element) {
    return;
  }

  element.textContent = text;

  element.className =
    `form-message ${type}`;

}


function toast(
  text,
  type = "success"
) {

  let container =
    $("toastContainer");

  if (!container) {

    container =
      document.createElement("div");

    container.id =
      "toastContainer";

    container.style.position =
      "fixed";

    container.style.right =
      "18px";

    container.style.bottom =
      "18px";

    container.style.zIndex =
      "99999";

    document.body.appendChild(
      container
    );

  }

  const item =
    document.createElement("div");

  item.textContent = text;

  item.style.padding =
    "12px 16px";

  item.style.marginTop =
    "8px";

  item.style.borderRadius =
    "10px";

  item.style.background =
    type === "error"
      ? "#ef4444"
      : "#4f46e5";

  item.style.color =
    "#ffffff";

  item.style.fontSize =
    "13px";

  item.style.boxShadow =
    "0 8px 25px rgba(0,0,0,.15)";

  container.appendChild(item);

  setTimeout(() => {

    item.remove();

  }, 3000);

}


function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function firebaseError(error) {

  const code =
    error?.code || "";

  const messages = {

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Password must contain at least 6 characters.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect email or password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "permission-denied":
      "You do not have permission for this action."

  };

  return (
    messages[code] ||
    error?.message ||
    "Something went wrong. Please try again."
  );

}


// ============================================================
// LOADER
// ============================================================

function hideLoader() {

  const loader =
    $("appLoader");

  if (loader) {
    loader.classList.add("hidden");
  }

}


// ============================================================
// PASSWORD TOGGLE
// ============================================================

function setupPasswordToggles() {

  document
    .querySelectorAll(
      "[data-password-toggle]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const targetId =
            button.dataset.passwordToggle;

          const input =
            $(targetId);

          if (!input) {
            return;
          }

          input.type =
            input.type === "password"
              ? "text"
              : "password";

        }
      );

    });

}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(event) {

  event.preventDefault();

  const email =
    $("loginEmail")
      ?.value
      .trim();

  const password =
    $("loginPassword")
      ?.value;

  message(
    "loginMessage",
    ""
  );

  if (!email) {

    message(
      "loginMessage",
      "Please enter your email."
    );

    return;
  }

  if (!password) {

    message(
      "loginMessage",
      "Please enter your password."
    );

    return;
  }

  const button =
    event.submitter;

  if (button) {

    button.disabled = true;

    button.textContent =
      "Signing in...";

  }

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    toast(
      "Login successful."
    );

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    message(
      "loginMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Login";

    }

  }

}


// ============================================================
// REGISTER ADMIN
// ============================================================

async function registerAdmin(event) {

  event.preventDefault();

  const name =
    $("registerName")
      ?.value
      .trim();

  const email =
    $("registerEmail")
      ?.value
      .trim();

  const password =
    $("registerPassword")
      ?.value;

  const confirmPassword =
    $("registerConfirmPassword")
      ?.value;

  message(
    "registerMessage",
    ""
  );

  if (!name) {

    message(
      "registerMessage",
      "Please enter your name."
    );

    return;
  }

  if (!email) {

    message(
      "registerMessage",
      "Please enter your email."
    );

    return;
  }

  if (!password || password.length < 6) {

    message(
      "registerMessage",
      "Password must contain at least 6 characters."
    );

    return;
  }

  if (
    password !==
    confirmPassword
  ) {

    message(
      "registerMessage",
      "Passwords do not match."
    );

    return;
  }

  const button =
    event.submitter;

  if (button) {

    button.disabled = true;

    button.textContent =
      "Creating Account...";

  }

  try {

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user =
      credential.user;

    await updateProfile(
      user,
      {
        displayName:
          name
      }
    );

    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      {

        uid:
          user.uid,

        name,

        email,

        role:
          "admin",

        active:
          true,

        createdAt:
          serverTimestamp()

      }
    );

    toast(
      "Admin account created successfully."
    );

    await loadProfile(
      user
    );

    showPage(
      "dashboard"
    );

  } catch (error) {

    console.error(
      "Register error:",
      error
    );

    message(
      "registerMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Register";

    }

  }

}


// ============================================================
// AUTH SCREEN
// ============================================================

function showLogin() {

  hide(
    "registerScreen"
  );

  show(
    "loginScreen"
  );

}


function showRegister() {

  hide(
    "loginScreen"
  );

  show(
    "registerScreen"
  );

}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile(
  firebaseUser
) {

  const ref =
    doc(
      db,
      "users",
      firebaseUser.uid
    );

  const snapshot =
    await getDoc(ref);

  if (!snapshot.exists()) {

    throw new Error(
      "User profile not found."
    );

  }

  state.profile = {
    id:
      snapshot.id,

    ...snapshot.data()
  };

}


// ============================================================
// START APPLICATION
// ============================================================

async function startApplication(
  firebaseUser
) {

  state.user =
    firebaseUser;

  await loadProfile(
    firebaseUser
  );

  if (
    state.profile.active === false
  ) {

    await signOut(auth);

    throw new Error(
      "This account is inactive."
    );

  }

  hide(
    "authScreen"
  );

  show(
    "mainApp"
  );

  updateUserUI();

  await loadUsers();

  await loadTasks();

  showPage(
    state.currentPage || "dashboard"
  );

}


// ============================================================
// USER UI
// ============================================================

function updateUserUI() {

  const name =
    state.profile?.name ||
    state.user?.displayName ||
    "User";

  const email =
    state.profile?.email ||
    state.user?.email ||
    "";

  document
    .querySelectorAll(
      "[data-user-name]"
    )
    .forEach(
      element => {
        element.textContent =
          name;
      }
    );

  document
    .querySelectorAll(
      "[data-user-email]"
    )
    .forEach(
      element => {
        element.textContent =
          email;
      }
    );

  document
    .querySelectorAll(
      "[data-user-role]"
    )
    .forEach(
      element => {

        element.textContent =
          state.profile?.role ||
          "";

      }
    );

  const version =
    $("appVersion");

  if (version) {
    version.textContent =
      `v${VERSION}`;
  }

}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function showPage(page) {

  state.currentPage =
    page;

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      element => {

        const target =
          element.dataset.page;

        element.classList.toggle(
          "active",
          target === page
        );

      }
    );

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      element => {

        element.classList.add(
          "hidden"
        );

      }
    );

  const pageElement =
    $(`${page}Page`);

  if (pageElement) {

    pageElement.classList.remove(
      "hidden"
    );

  }

  closeMobileSidebar();

  if (page === "dashboard") {

    updateDashboard();

  }

  if (page === "tasks") {

    renderTasks();

  }

  if (page === "users") {

    renderUsers();

  }

  if (page === "progress") {

    renderProgress();

  }

}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {

  try {

    const role =
      state.profile?.role;

    let snapshot;

    if (
      role === "admin" ||
      role === "superadmin"
    ) {

      const q =
        query(
          collection(
            db,
            "users"
          ),
          where(
            "role",
            "==",
            "student"
          )
        );

      snapshot =
        await getDocs(q);

    } else {

      snapshot =
        await getDocs(
          query(
            collection(
              db,
              "users"
            ),
            where(
              "uid",
              "==",
              state.user.uid
            )
          )
        );

    }

    state.users =
      snapshot.docs.map(
        item => ({
          id:
            item.id,
          ...item.data()
        })
      );

  } catch (error) {

    console.error(
      "Load users error:",
      error
    );

    state.users = [];

    toast(
      firebaseError(error),
      "error"
    );

  }

}


// ============================================================
// LOAD TASKS
// ============================================================

async function loadTasks() {

  try {

    const role =
      state.profile?.role;

    if (
      role === "admin" ||
      role === "superadmin"
    ) {

      let snapshot;

      try {

        const q =
          query(
            collection(
              db,
              "tasks"
            ),
            orderBy(
              "assignedAt",
              "desc"
            )
          );

        snapshot =
          await getDocs(q);

      } catch (error) {

        // Fallback if index is not yet available
        snapshot =
          await getDocs(
            collection(
              db,
              "tasks"
            )
          );

      }

      state.tasks =
        snapshot.docs.map(
          item => ({
            id:
              item.id,
            ...item.data()
          })
        );

      state.tasks.sort(
        (a, b) => {

          const aTime =
            a.assignedAt?.seconds ||
            0;

          const bTime =
            b.assignedAt?.seconds ||
            0;

          return bTime - aTime;

        }
      );

    } else {

      const q =
        query(
          collection(
            db,
            "tasks"
          ),
          where(
            "assignedTo",
            "==",
            state.user.uid
          )
        );

      const snapshot =
        await getDocs(q);

      state.tasks =
        snapshot.docs.map(
          item => ({
            id:
              item.id,
            ...item.data()
          })
        );

      state.tasks.sort(
        (a, b) => {

          const aTime =
            a.assignedAt?.seconds ||
            0;

          const bTime =
            b.assignedAt?.seconds ||
            0;

          return bTime - aTime;

        }
      );

    }

  } catch (error) {

    console.error(
      "Load tasks error:",
      error
    );

    state.tasks = [];

    toast(
      firebaseError(error),
      "error"
    );

  }

}


// ============================================================
// DATE HELPERS
// ============================================================

function timestampToDate(
  value
) {

  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {

    return value.toDate();

  }

  if (
    value.seconds
  ) {

    return new Date(
      value.seconds * 1000
    );

  }

  if (
    typeof value ===
    "string"
  ) {

    return new Date(value);

  }

  return null;

}


function formatDate(
  value
) {

  const date =
    timestampToDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric"
    }
  );

}


function formatDateTime(
  value
) {

  const date =
    timestampToDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  );

}


// ============================================================
// DURATION
// ============================================================

function formatDuration(
  milliseconds
) {

  const ms =
    Number(milliseconds) || 0;

  const seconds =
    Math.floor(
      ms / 1000
    );

  if (seconds < 60) {

    return `${seconds}s`;

  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    seconds % 60;

  if (minutes < 60) {

    return `${minutes}m ${remainingSeconds}s`;

  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remainingMinutes =
    minutes % 60;

  return `${hours}h ${remainingMinutes}m`;

}


// ============================================================
// STATUS
// ============================================================

function statusClass(
  status
) {

  return `status-${status || "pending"}`;

}


function statusLabel(
  status
) {

  const labels = {

    pending:
      "Pending",

    accepted:
      "Accepted",

    in_progress:
      "In Progress",

    completed:
      "Completed"

  };

  return (
    labels[status] ||
    "Pending"
  );

}


// ============================================================
// USER NAME
// ============================================================

function getUserName(
  uid
) {

  const user =
    state.users.find(
      item =>
        (item.uid || item.id) === uid
    );

  return (
    user?.name ||
    "Student"
  );

}


function getAssignerName(
  task
) {

  return (
    task?.assignedByName ||
    "Admin"
  );

}


// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard() {

  const role =
    state.profile?.role;

  const totalTasks =
    state.tasks.length;

  const completedTasks =
    state.tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  const pendingTasks =
    state.tasks.filter(
      task =>
        task.status ===
        "pending"
    ).length;

  const activeTasks =
    state.tasks.filter(
      task =>
        task.status ===
          "accepted" ||
        task.status ===
          "in_progress"
    ).length;

  setText(
    "totalTasks",
    totalTasks
  );

  setText(
    "completedTasks",
    completedTasks
  );

  setText(
    "pendingTasks",
    pendingTasks
  );

  setText(
    "activeTasks",
    activeTasks
  );

  setText(
    "totalUsers",
    state.users.length
  );

  renderRecentTasks();

}


function setText(
  id,
  value
) {

  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }

}


// ============================================================
// RECENT TASKS
// ============================================================

function renderRecentTasks() {

  const container =
    $("recentTasks");

  if (!container) {
    return;
  }

  const tasks =
    state.tasks.slice(
      0,
      5
    );

  if (!tasks.length) {

    container.innerHTML =
      emptyHTML(
        "✓",
        "No tasks yet",
        "Tasks will appear here when they are assigned."
      );

    return;
  }

  container.innerHTML =
    tasks.map(
      task => {

        const studentName =
          task.assignedToName ||
          getUserName(
            task.assignedTo
          );

        return `

          <div class="task-row">

            <div class="task-row-main">

              <strong>
                ${escapeHTML(
                  task.title ||
                  "Untitled Task"
                )}
              </strong>

              <span>
                ${escapeHTML(
                  studentName
                )}
              </span>

            </div>

            <span class="
              status-badge
              ${statusClass(task.status)}
            ">
              ${escapeHTML(
                statusLabel(task.status)
              )}
            </span>

          </div>

        `;

      }
    ).join("");

}


// ============================================================
// TASK HTML
// ============================================================

function taskHTML(
  task
) {

  const role =
    state.profile?.role;

  const studentName =
    task.assignedToName ||
    getUserName(
      task.assignedTo
    );

  const assignerName =
    getAssignerName(
      task
    );

  let actionHTML = "";

  if (
    role === "student" &&
    task.assignedTo ===
      state.user.uid
  ) {

    if (
      task.status ===
      "pending"
    ) {

      actionHTML = `
        <button
          class="btn btn-primary"
          data-task-action="accept"
          data-task-id="${escapeHTML(task.id)}"
        >
          Accept
        </button>
      `;

    } else if (
      task.status ===
      "accepted"
    ) {

      actionHTML = `
        <button
          class="btn btn-primary"
          data-task-action="start"
          data-task-id="${escapeHTML(task.id)}"
        >
          Start Task
        </button>
      `;

    } else if (
      task.status ===
      "in_progress"
    ) {

      actionHTML = `
        <button
          class="btn btn-primary"
          data-task-action="complete"
          data-task-id="${escapeHTML(task.id)}"
        >
          Complete
        </button>
      `;

    }

  }

  return `

    <div
      class="task-card"
      data-task-id="${escapeHTML(task.id)}"
    >

      <div class="task-card-header">

        <div>

          <h4>
            ${escapeHTML(
              task.title ||
              "Untitled Task"
            )}
          </h4>

          <span>
            ${formatDateTime(
              task.assignedAt
            )}
          </span>

        </div>

        <span class="
          status-badge
          ${statusClass(task.status)}
        ">
          ${escapeHTML(
            statusLabel(task.status)
          )}
        </span>

      </div>

      <p>
        ${escapeHTML(
          task.description ||
          ""
        )}
      </p>

      <div
        style="
          display:grid;
          gap:5px;
          margin-top:10px;
          font-size:12px;
          color:#667085;
        "
      >

        <div>
          <strong>Assigned to:</strong>
          ${escapeHTML(studentName)}
        </div>

        <div>
          <strong>Assigned by:</strong>
          ${escapeHTML(assignerName)}
        </div>

        <div>
          <strong>Due date:</strong>
          ${escapeHTML(
            task.dueDate ||
            "No due date"
          )}
        </div>

        ${
          task.durationMs
            ? `
              <div>
                <strong>Duration:</strong>
                ${escapeHTML(
                  formatDuration(
                    task.durationMs
                  )
                )}
              </div>
            `
            : ""
        }

      </div>

      ${
        actionHTML
          ? `
            <div
              class="task-actions"
              style="margin-top:12px;"
            >
              ${actionHTML}
            </div>
          `
          : ""
      }

    </div>

  `;

}


// ============================================================
// TASK ACTIONS
// ============================================================

async function acceptTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id === taskId
    );

  if (!task) {
    return;
  }

  if (
    task.assignedTo !==
    state.user.uid
  ) {
    return;
  }

  try {

    await updateDoc(
      doc(
        db,
        "tasks",
        taskId
      ),
      {

        status:
          "accepted",

        acceptedAt:
          serverTimestamp()

      }
    );

    await loadTasks();

    renderTasks();
    updateDashboard();
    renderProgress();

    toast(
      "Task accepted."
    );

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );

  }

}


async function startTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id === taskId
    );

  if (!task) {
    return;
  }

  if (
    task.assignedTo !==
    state.user.uid
  ) {
    return;
  }

  try {

    await updateDoc(
      doc(
        db,
        "tasks",
        taskId
      ),
      {

        status:
          "in_progress",

        startedAt:
          serverTimestamp()

      }
    );

    await loadTasks();

    renderTasks();
    updateDashboard();
    renderProgress();

    toast(
      "Task started."
    );

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );

  }

}


async function completeTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id === taskId
    );

  if (!task) {
    return;
  }

  if (
    task.assignedTo !==
    state.user.uid
  ) {
    return;
  }

  try {

    const started =
      timestampToDate(
        task.startedAt
      );

    let durationMs =
      Number(
        task.durationMs
      ) || 0;

    if (started) {

      durationMs =
        Math.max(
          0,
          Date.now() -
          started.getTime()
        );

    }

    await updateDoc(
      doc(
        db,
        "tasks",
        taskId
      ),
      {

        status:
          "completed",

        completedAt:
          serverTimestamp(),

        durationMs

      }
    );

    await loadTasks();

    renderTasks();
    updateDashboard();
    renderProgress();

    toast(
      "Task completed successfully."
    );

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );

  }

}


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks() {

  const container =
    $("tasksList");

  if (!container) {
    return;
  }

  let tasks =
    [...state.tasks];

  const search =
    $("taskSearch")
      ?.value
      .trim()
      .toLowerCase();

  const status =
    $("taskStatusFilter")
      ?.value || "";

  if (search) {

    tasks =
      tasks.filter(
        task => {

          const text =
            [
              task.title,
              task.description,
              task.assignedToName,
              task.assignedByName
            ]
              .join(" ")
              .toLowerCase();

          return text.includes(
            search
          );

        }
      );

  }

  if (status) {

    tasks =
      tasks.filter(
        task =>
          task.status ===
          status
      );

  }

  if (!tasks.length) {

    container.innerHTML =
      emptyHTML(
        "✓",
        "No tasks found",
        "There are no tasks matching your current filters."
      );

    return;
  }

  container.innerHTML =
    tasks
      .map(taskHTML)
      .join("");

}


// ============================================================
// RENDER USERS
// ============================================================

function renderUsers() {

  const container =
    $("usersList");

  if (!container) {
    return;
  }

  const students =
    state.users.filter(
      user =>
        user.role ===
        "student"
    );

  if (
    state.profile?.role ===
    "superadmin"
  ) {

    renderSuperAdminUsers(
      container,
      students
    );

    return;

  }

  if (!students.length) {

    container.innerHTML =
      emptyHTML(
        "👤",
        "No students found",
        "Create a student account to get started."
      );

    return;

  }

  container.innerHTML =
    students
      .map(
        student => {

          const studentTasks =
            state.tasks.filter(
              task =>
                task.assignedTo ===
                student.uid
            );

          const completed =
            studentTasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;

          const total =
            studentTasks.length;

          const progress =
            total
              ? Math.round(
                  completed /
                  total *
                  100
                )
              : 0;

          return `

            <div
              class="user-card"
              data-user-progress="${escapeHTML(
                student.uid ||
                student.id
              )}"
              style="cursor:pointer;"
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:10px;
                "
              >

                <div>

                  <strong>
                    ${escapeHTML(
                      student.name ||
                      "Student"
                    )}
                  </strong>

                  <div
                    style="
                      font-size:11px;
                      color:#667085;
                      margin-top:3px;
                    "
                  >
                    ${escapeHTML(
                      student.email ||
                      ""
                    )}
                  </div>

                </div>

                <span class="
                  status-badge
                  status-completed
                ">
                  ${progress}%
                </span>

              </div>

              <div
                style="
                  margin-top:10px;
                  height:7px;
                  background:#edf0f5;
                  border-radius:10px;
                  overflow:hidden;
                "
              >

                <div
                  style="
                    width:${progress}%;
                    height:100%;
                    background:#4f46e5;
                    border-radius:10px;
                  "
                ></div>

              </div>

              <div
                style="
                  margin-top:7px;
                  font-size:10px;
                  color:#667085;
                "
              >
                ${completed}
                completed /
                ${total}
                tasks
              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// SUPER ADMIN USERS / ADMINS
// ============================================================

function renderSuperAdminUsers(
  container,
  students
) {

  const admins =
    [];

  if (
    state.profile?.role ===
    "superadmin"
  ) {

    // Current admin profile
    // is not necessarily inside state.users,
    // so collect admin data from task/user records
    // when available.

    // We fetch all admin profiles here.
    loadAllAdminsForSuperAdmin(
      container,
      students
    );

    return;

  }

  container.innerHTML = "";

}


// ============================================================
// LOAD ALL ADMINS FOR SUPER ADMIN
// ============================================================

async function loadAllAdminsForSuperAdmin(
  container,
  students
) {

  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "users"
          ),
          where(
            "role",
            "==",
            "admin"
          )
        )
      );

    const admins =
      snapshot.docs.map(
        item => ({
          id:
            item.id,
          ...item.data()
        })
      );

    let html = `

      <div
        style="
          padding:14px;
          border-radius:13px;
          background:#fff;
          border:1px solid #edf0f5;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            margin-bottom:12px;
          "
        >

          <strong>
            Admin Accounts
          </strong>

          <strong
            style="
              color:#4f46e5;
              font-size:12px;
            "
          >
            ${admins.length}
            admin${admins.length === 1 ? "" : "s"}
          </strong>

        </div>

        <div
          style="
            display:grid;
            gap:10px;
          "
        >

    `;

    if (!admins.length) {

      html += `

        <div
          style="
            padding:15px;
            text-align:center;
            color:#98a2b3;
            font-size:11px;
          "
        >
          No admin accounts found.
        </div>

      `;

    } else {

      html += admins
        .map(
          admin => {

            const adminStudents =
              students.filter(
                student =>
                  student.createdBy ===
                  admin.uid
              );

            const adminTasks =
              state.tasks.filter(
                task =>
                  task.assignedBy ===
                  admin.uid
              );

            const completed =
              adminTasks.filter(
                task =>
                  task.status ===
                  "completed"
              ).length;

            const progress =
              adminTasks.length
                ? Math.round(
                    completed /
                    adminTasks.length *
                    100
                  )
                : 0;

            const taskRows =
              adminTasks.length
                ? adminTasks
                    .slice(0, 8)
                    .map(
                      task => `

                        <div
                          style="
                            padding:9px;
                            border-radius:8px;
                            background:#f8f9fc;
                            font-size:10px;
                          "
                        >

                          <strong>
                            ${escapeHTML(
                              task.title ||
                              "Untitled"
                            )}
                          </strong>

                          <div
                            style="
                              margin-top:3px;
                              color:#667085;
                            "
                          >
                            Student:
                            ${escapeHTML(
                              task.assignedToName ||
                              getUserName(
                                task.assignedTo
                              )
                            )}
                          </div>

                          <div
                            style="
                              margin-top:3px;
                              color:#667085;
                            "
                          >
                            Status:
                            ${escapeHTML(
                              statusLabel(
                                task.status
                              )
                            )}
                          </div>

                        </div>

                      `
                    )
                    .join("")
                : `
                    <div
                      style="
                        color:#98a2b3;
                        font-size:10px;
                      "
                    >
                      No tasks assigned yet.
                    </div>
                  `;

            return `

              <div
                style="
                  padding:14px;
                  border-radius:13px;
                  background:#f8f9fc;
                  border:1px solid #edf0f5;
                "
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    align-items:center;
                  "
                >

                  <div>

                    <strong
                      style="
                        display:block;
                        font-size:13px;
                        color:#344054;
                      "
                    >
                      ${escapeHTML(
                        admin.name ||
                        "Admin"
                      )}
                    </strong>

                    <span
                      style="
                        display:block;
                        margin-top:3px;
                        font-size:10px;
                        color:#667085;
                      "
                    >
                      ${escapeHTML(
                        admin.email ||
                        ""
                      )}
                    </span>

                    <span
                      style="
                        display:block;
                        margin-top:3px;
                        font-size:10px;
                        color:#98a2b3;
                      "
                    >
                      Created:
                      ${escapeHTML(
                        formatDateTime(
                          admin.createdAt
                        )
                      )}
                    </span>

                  </div>

                  <span class="
                    status-badge
                    status-completed
                  ">
                    Admin
                  </span>

                </div>

                <div
                  style="
                    display:grid;
                    grid-template-columns:
                      repeat(3,1fr);
                    gap:7px;
                    margin-top:12px;
                  "
                >

                  <div
                    style="
                      text-align:center;
                      padding:9px;
                      background:#fff;
                      border-radius:9px;
                    "
                  >

                    <strong>
                      ${adminStudents.length}
                    </strong>

                    <div
                      style="
                        font-size:9px;
                        color:#667085;
                      "
                    >
                      Users Created
                    </div>

                  </div>

                  <div
                    style="
                      text-align:center;
                      padding:9px;
                      background:#fff;
                      border-radius:9px;
                    "
                  >

                    <strong>
                      ${adminTasks.length}
                    </strong>

                    <div
                      style="
                        font-size:9px;
                        color:#667085;
                      "
                    >
                      Tasks
                    </div>

                  </div>

                  <div
                    style="
                      text-align:center;
                      padding:9px;
                      background:#fff;
                      border-radius:9px;
                    "
                  >

                    <strong>
                      ${completed}
                    </strong>

                    <div
                      style="
                        font-size:9px;
                        color:#667085;
                      "
                    >
                      Done
                    </div>

                  </div>

                </div>

                <div
                  style="
                    margin-top:10px;
                    font-size:10px;
                    color:#667085;
                  "
                >
                  Progress:
                  <strong>
                    ${progress}%
                  </strong>
                </div>

                <div
                  style="
                    margin-top:5px;
                    height:6px;
                    background:#e9edf5;
                    border-radius:10px;
                    overflow:hidden;
                  "
                >

                  <div
                    style="
                      width:${progress}%;
                      height:100%;
                      background:#4f46e5;
                    "
                  ></div>

                </div>

                <div
                  style="
                    margin-top:12px;
                    display:grid;
                    gap:6px;
                  "
                >

                  <strong
                    style="
                      font-size:11px;
                      color:#344054;
                    "
                  >
                    Assigned Tasks
                  </strong>

                  ${taskRows}

                </div>

              </div>

            `;

          }
        )
        .join("");

    }

    html += `

        </div>

      </div>

    `;

    container.innerHTML =
      html;

  } catch (error) {

    console.error(
      "Load admins error:",
      error
    );

    container.innerHTML =
      emptyHTML(
        "⚠",
        "Could not load admins",
        firebaseError(error)
      );

  }

}


// ============================================================
// PROGRESS
// ============================================================

function progressPercentage(
  tasks
) {

  if (!tasks.length) {
    return 0;
  }

  const completed =
    tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  return Math.round(
    completed /
    tasks.length *
    100
  );

}


// ============================================================
// ALL STUDENTS PROGRESS
// ============================================================

function renderAllStudentsProgress() {

  const container =
    $("allStudentsProgress");

  if (!container) {
    return;
  }

  const students =
    state.users.filter(
      user =>
        user.role ===
        "student"
    );

  if (!students.length) {

    container.innerHTML =
      emptyHTML(
        "📊",
        "No student progress",
        "Student progress will appear here."
      );

    return;

  }

  container.innerHTML =
    students
      .map(
        student => {

          const tasks =
            state.tasks.filter(
              task =>
                task.assignedTo ===
                student.uid
            );

          const completed =
            tasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;

          const percentage =
            progressPercentage(
              tasks
            );

          return `

            <div
              class="progress-card"
              data-user-progress="${escapeHTML(
                student.uid
              )}"
              style="cursor:pointer;"
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:10px;
                "
              >

                <div>

                  <strong>
                    ${escapeHTML(
                      student.name ||
                      "Student"
                    )}
                  </strong>

                  <div
                    style="
                      font-size:10px;
                      color:#667085;
                      margin-top:3px;
                    "
                  >
                    ${escapeHTML(
                      student.email ||
                      ""
                    )}
                  </div>

                </div>

                <strong
                  style="
                    color:#4f46e5;
                  "
                >
                  ${percentage}%
                </strong>

              </div>

              <div
                style="
                  height:8px;
                  background:#edf0f5;
                  border-radius:10px;
                  margin-top:10px;
                  overflow:hidden;
                "
              >

                <div
                  style="
                    width:${percentage}%;
                    height:100%;
                    background:#4f46e5;
                  "
                ></div>

              </div>

              <div
                style="
                  margin-top:6px;
                  font-size:10px;
                  color:#667085;
                "
              >
                ${completed}
                completed of
                ${tasks.length}
                tasks
              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// INDIVIDUAL STUDENT PROGRESS
// ============================================================

function renderIndividualProgress() {

  const container =
    $("individualProgress");

  if (!container) {
    return;
  }

  const student =
    state.users.find(
      user =>
        (user.uid || user.id) ===
        state.selectedStudentId
    );

  if (!student) {

    container.innerHTML =
      "";

    return;

  }

  const tasks =
    state.tasks.filter(
      task =>
        task.assignedTo ===
        student.uid
    );

  const completed =
    tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  const pending =
    tasks.filter(
      task =>
        task.status ===
        "pending"
    ).length;

  const active =
    tasks.filter(
      task =>
        task.status ===
          "accepted" ||
        task.status ===
          "in_progress"
    ).length;

  const percentage =
    progressPercentage(
      tasks
    );

  container.innerHTML = `

    <div
      style="
        padding:15px;
        border-radius:14px;
        background:#fff;
        border:1px solid #edf0f5;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          align-items:center;
        "
      >

        <div>

          <strong>
            ${escapeHTML(
              student.name ||
              "Student"
            )}
          </strong>

          <div
            style="
              font-size:10px;
              color:#667085;
              margin-top:3px;
            "
          >
            ${escapeHTML(
              student.email ||
              ""
            )}
          </div>

        </div>

        <button
          class="btn btn-secondary"
          data-close-student-progress
        >
          Close
        </button>

      </div>

      <div
        style="
          margin-top:15px;
          text-align:center;
        "
      >

        <strong
          style="
            font-size:28px;
            color:#4f46e5;
          "
        >
          ${percentage}%
        </strong>

        <div
          style="
            font-size:11px;
            color:#667085;
          "
        >
          Overall Progress
        </div>

      </div>

      <div
        style="
          height:9px;
          background:#edf0f5;
          border-radius:10px;
          overflow:hidden;
          margin-top:10px;
        "
      >

        <div
          style="
            width:${percentage}%;
            height:100%;
            background:#4f46e5;
          "
        ></div>

      </div>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(3,1fr);
          gap:7px;
          margin-top:13px;
        "
      >

        <div
          style="
            text-align:center;
            padding:9px;
            background:#f8f9fc;
            border-radius:9px;
          "
        >

          <strong>
            ${completed}
          </strong>

          <div
            style="
              font-size:9px;
              color:#667085;
            "
          >
            Completed
          </div>

        </div>

        <div
          style="
            text-align:center;
            padding:9px;
            background:#f8f9fc;
            border-radius:9px;
          "
        >

          <strong>
            ${active}
          </strong>

          <div
            style="
              font-size:9px;
              color:#667085;
            "
          >
            Active
          </div>

        </div>

        <div
          style="
            text-align:center;
            padding:9px;
            background:#f8f9fc;
            border-radius:9px;
          "
        >

          <strong>
            ${pending}
          </strong>

          <div
            style="
              font-size:9px;
              color:#667085;
            "
          >
            Pending
          </div>

        </div>

      </div>

      <div
        style="
          margin-top:15px;
          display:grid;
          gap:7px;
        "
      >

        ${
          tasks.length
            ? tasks
                .map(
                  task => `

                    <div
                      style="
                        padding:10px;
                        border-radius:9px;
                        background:#f8f9fc;
                      "
                    >

                      <strong
                        style="
                          font-size:11px;
                        "
                      >
                        ${escapeHTML(
                          task.title ||
                          "Untitled Task"
                        )}
                      </strong>

                      <div
                        style="
                          margin-top:4px;
                          font-size:9px;
                          color:#667085;
                        "
                      >
                        Assigned by:
                        ${escapeHTML(
                          getAssignerName(
                            task
                          )
                        )}
                      </div>

                      <div
                        style="
                          margin-top:3px;
                          font-size:9px;
                          color:#667085;
                        "
                      >
                        Status:
                        ${escapeHTML(
                          statusLabel(
                            task.status
                          )
                        )}
                      </div>

                      <div
                        style="
                          margin-top:3px;
                          font-size:9px;
                          color:#667085;
                        "
                      >
                        Assigned:
                        ${escapeHTML(
                          formatDate(
                            task.assignedAt
                          )
                        )}
                      </div>

                    </div>

                  `
                )
                .join("")
            : `
                <div
                  style="
                    text-align:center;
                    padding:15px;
                    color:#98a2b3;
                    font-size:11px;
                  "
                >
                  No tasks assigned.
                </div>
              `
        }

      </div>

    </div>

  `;

}


// ============================================================
// PROGRESS PAGE
// ============================================================

function renderProgress() {

  const allContainer =
    $("allStudentsProgress");

  const individualContainer =
    $("individualProgress");

  if (
    allContainer
  ) {

    renderAllStudentsProgress();

  }

  if (
    individualContainer
  ) {

    renderIndividualProgress();

  }

}


// ============================================================
// USER MODAL
// ============================================================

function openUserModal() {

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {

    toast(
      "Only admins can create users.",
      "error"
    );

    return;
  }

  show(
    "userModal"
  );

  message(
    "userMessage",
    ""
  );

  $("userForm")
    ?.reset();

}


function closeUserModal() {

  hide(
    "userModal"
  );

}


// ============================================================
// TASK MODAL
// ============================================================

function openTaskModal() {

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {

    toast(
      "Only admins can assign tasks.",
      "error"
    );

    return;
  }

  show(
    "taskModal"
  );

  message(
    "taskMessage",
    ""
  );

  $("taskForm")
    ?.reset();

  populateTaskUsers();

}


function closeTaskModal() {

  hide(
    "taskModal"
  );

}


// ============================================================
// TASK USERS
// ============================================================

function populateTaskUsers() {

  const select =
    $("taskUser");

  if (!select) {
    return;
  }

  select.innerHTML = `

    <option value="">
      Select a user
    </option>

  `;

  const students =
    state.users.filter(
      user =>
        user.role ===
        "student"
    );

  students.forEach(
    user => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        user.uid ||
        user.id;

      option.textContent =
        `${user.name || "User"} — ${
          user.email || ""
        }`;

      select.appendChild(
        option
      );

    }
  );

}


// ============================================================
// CREATE USER
// ============================================================

async function createUser(
  event
) {

  event.preventDefault();

  const role =
    state.profile?.role;

  if (
    role !== "admin" &&
    role !== "superadmin"
  ) {

    message(
      "userMessage",
      "Only admins can create users."
    );

    return;
  }

  const name =
    $("userName")
      ?.value
      .trim();

  const email =
    $("userEmail")
      ?.value
      .trim()
      .toLowerCase();

  const password =
    $("userPassword")
      ?.value;

  message(
    "userMessage",
    ""
  );

  if (!name) {

    message(
      "userMessage",
      "Please enter the student's name."
    );

    return;
  }

  if (!email) {

    message(
      "userMessage",
      "Please enter the student's email."
    );

    return;
  }

  if (
    !password ||
    password.length < 6
  ) {

    message(
      "userMessage",
      "Password must contain at least 6 characters."
    );

    return;
  }

  // ----------------------------------------------------------
  // IMPORTANT:
  // Same email means same student account.
  // Do not create duplicate student accounts.
  // ----------------------------------------------------------

  const existingStudent =
    state.users.find(
      user =>
        user.role === "student" &&
        String(
          user.email || ""
        ).toLowerCase() ===
        email
    );

  if (existingStudent) {

    message(
      "userMessage",
      "This email already belongs to an existing student. Use that student when assigning tasks."
    );

    return;
  }

  if (!secondaryAuth) {

    message(
      "userMessage",
      "Secure user creation is not available. Please refresh the page."
    );

    return;
  }

  const button =
    event.submitter;

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Creating User...";

  }

  try {

    const credential =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );

    const student =
      credential.user;

    await updateProfile(
      student,
      {
        displayName:
          name
      }
    );

    await setDoc(
      doc(
        db,
        "users",
        student.uid
      ),
      {

        uid:
          student.uid,

        name,

        email,

        role:
          "student",

        active:
          true,

        createdBy:
          state.user.uid,

        createdByName:
          state.profile?.name ||
          state.user.displayName ||
          "Admin",

        createdAt:
          serverTimestamp()

      }
    );

    await signOut(
      secondaryAuth
    );

    message(
      "userMessage",
      "Student created successfully.",
      "success"
    );

    toast(
      "Student account created successfully."
    );

    $("userForm")
      ?.reset();

    await loadUsers();

    await loadTasks();

    renderUsers();

    renderProgress();

    populateTaskUsers();

    setTimeout(
      () => {
        closeUserModal();
      },
      900
    );

  } catch (error) {

    console.error(
      "Create user error:",
      error
    );

    message(
      "userMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Create User";

    }

  }

}


// ============================================================
// CREATE TASK
// ============================================================

async function createTask(
  event
) {

  event.preventDefault();

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {
    return;
  }

  const title =
    $("taskTitle")
      ?.value
      .trim();

  const description =
    $("taskDescription")
      ?.value
      .trim();

  const assignedTo =
    $("taskUser")
      ?.value;

  const dueDate =
    $("taskDueDate")
      ?.value ||
    null;

  message(
    "taskMessage",
    ""
  );

  if (!title) {

    message(
      "taskMessage",
      "Please enter a task title."
    );

    return;
  }

  if (!description) {

    message(
      "taskMessage",
      "Please enter a task description."
    );

    return;
  }

  if (!assignedTo) {

    message(
      "taskMessage",
      "Please select a user."
    );

    return;
  }

  const button =
    event.submitter;

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Assigning...";

  }

  try {

    const assignedStudent =
      state.users.find(
        user =>
          (
            user.uid ||
            user.id
          ) ===
          assignedTo
      );

    if (!assignedStudent) {

      throw new Error(
        "Selected student was not found."
      );

    }

    await addDoc(
      collection(
        db,
        "tasks"
      ),
      {

        title,

        description,

        assignedTo,

        assignedToName:
          assignedStudent.name ||
          "Student",

        assignedBy:
          state.user.uid,

        assignedByName:
          state.profile?.name ||
          state.user.displayName ||
          "Admin",

        status:
          "pending",

        dueDate,

        assignedAt:
          serverTimestamp(),

        acceptedAt:
          null,

        startedAt:
          null,

        completedAt:
          null,

        durationMs:
          0

      }
    );

    toast(
      "Task assigned successfully."
    );

    closeTaskModal();

    await loadTasks();

    updateDashboard();

    renderTasks();

    renderProgress();

    renderUsers();

  } catch (error) {

    console.error(
      "Create task error:",
      error
    );

    message(
      "taskMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Assign Task";

    }

  }

}


// ============================================================
// TASK FILTERS
// ============================================================

function setupTaskFilters() {

  $("taskSearch")
    ?.addEventListener(
      "input",
      renderTasks
    );

  $("taskStatusFilter")
    ?.addEventListener(
      "change",
      renderTasks
    );

}


// ============================================================
// MOBILE SIDEBAR
// ============================================================

function openMobileSidebar() {

  $("sidebar")
    ?.classList
    .add("open");

  $("sidebarOverlay")
    ?.classList
    .remove("hidden");

}


function closeMobileSidebar() {

  $("sidebar")
    ?.classList
    .remove("open");

  $("sidebarOverlay")
    ?.classList
    .add("hidden");

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  $("loginForm")
    ?.addEventListener(
      "submit",
      loginUser
    );


  $("registerForm")
    ?.addEventListener(
      "submit",
      registerAdmin
    );


  $("showRegisterBtn")
    ?.addEventListener(
      "click",
      showRegister
    );


  $("showLoginBtn")
    ?.addEventListener(
      "click",
      showLogin
    );


  setupPasswordToggles();


  // ----------------------------------------------------------
  // NAVIGATION
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      item => {

        item.addEventListener(
          "click",
          () => {

            const page =
              item.dataset.page;

            if (page) {

              showPage(
                page
              );

            }

          }
        );

      }
    );


  // ----------------------------------------------------------
  // PAGE TARGET BUTTONS
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      "[data-page-target]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            showPage(
              button.dataset.pageTarget
            );

          }
        );

      }
    );


  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  $("logoutBtn")
    ?.addEventListener(
      "click",
      async () => {

        try {

          await signOut(
            auth
          );

          toast(
            "Logged out successfully."
          );

        } catch (error) {

          console.error(
            error
          );

        }

      }
    );


  // ----------------------------------------------------------
  // ADD USER
  // ----------------------------------------------------------

  $("addUserBtn")
    ?.addEventListener(
      "click",
      openUserModal
    );


  // ----------------------------------------------------------
  // ADD TASK
  // ----------------------------------------------------------

  $("addTaskBtn")
    ?.addEventListener(
      "click",
      openTaskModal
    );


  // ----------------------------------------------------------
  // USER FORM
  // ----------------------------------------------------------

  $("userForm")
    ?.addEventListener(
      "submit",
      createUser
    );


  // ----------------------------------------------------------
  // TASK FORM
  // ----------------------------------------------------------

  $("taskForm")
    ?.addEventListener(
      "submit",
      createTask
    );


  // ----------------------------------------------------------
  // MODAL CLOSE BUTTONS
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const modalId =
              button.dataset.closeModal;

            hide(
              modalId
            );

          }
        );

      }
    );


  // ----------------------------------------------------------
  // MODAL BACKDROP
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      ".modal-backdrop"
    )
    .forEach(
      backdrop => {

        backdrop.addEventListener(
          "click",
          () => {

            const modal =
              backdrop.closest(
                ".modal"
              );

            modal?.classList.add(
              "hidden"
            );

          }
        );

      }
    );


  // ----------------------------------------------------------
  // MOBILE MENU
  // ----------------------------------------------------------

  $("mobileMenuBtn")
    ?.addEventListener(
      "click",
      openMobileSidebar
    );


  $("sidebarOverlay")
    ?.addEventListener(
      "click",
      closeMobileSidebar
    );


  setupTaskFilters();


  // ----------------------------------------------------------
  // TASK ACTIONS
  // ----------------------------------------------------------

  document.addEventListener(
    "click",
    async event => {

      const button =
        event.target.closest(
          "[data-task-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.taskAction;

      const taskId =
        button.dataset.taskId;

      if (!taskId) {
        return;
      }

      if (
        action === "accept"
      ) {

        await acceptTask(
          taskId
        );

      }

      if (
        action === "start"
      ) {

        await startTask(
          taskId
        );

      }

      if (
        action === "complete"
      ) {

        await completeTask(
          taskId
        );

      }

    }
  );


  // ----------------------------------------------------------
  // STUDENT PROGRESS
  // IMPORTANT:
  // showPage() is called BEFORE selectedStudentId is set.
  // This prevents the selected ID from being reset.
  // ----------------------------------------------------------

  document.addEventListener(
    "click",
    event => {

      const card =
        event.target.closest(
          "[data-user-progress]"
        );

      if (!card) {
        return;
      }

      const studentId =
        card.dataset.userProgress;

      if (!studentId) {
        return;
      }

      const student =
        state.users.find(
          user =>
            (
              user.uid ||
              user.id
            ) ===
            studentId
        );

      if (
        !student ||
        student.role !==
          "student"
      ) {

        return;
      }

      if (
        state.currentPage !==
        "progress"
      ) {

        showPage(
          "progress"
        );

      }

      state.selectedStudentId =
        studentId;

      renderProgress();

    }
  );


  // ----------------------------------------------------------
  // CLOSE INDIVIDUAL PROGRESS
  // ----------------------------------------------------------

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-close-student-progress]"
        );

      if (!button) {
        return;
      }

      state.selectedStudentId =
        null;

      renderProgress();

    }
  );

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async firebaseUser => {

    try {

      if (firebaseUser) {

        await startApplication(
          firebaseUser
        );

      } else {

        show(
          "authScreen"
        );

        hide(
          "mainApp"
        );

        state.user =
          null;

        state.profile =
          null;

        state.users =
          [];

        state.tasks =
          [];

      }

    } catch (error) {

      console.error(
        "Application start error:",
        error
      );

      show(
        "authScreen"
      );

      hide(
        "mainApp"
      );

    } finally {

      hideLoader();

    }

  }
);


// ============================================================
// START
// ============================================================

setupEvents();
