// ============================================================
// TASK MANAGER
// Main Application
// Version 1.0.3
// ============================================================

import {
  auth,
  db,
  app
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getAuth
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ============================================================
// SECONDARY FIREBASE APP
// Used to create students without logging admin out
// ============================================================

let secondaryApp = null;
let secondaryAuth = null;

try {

  secondaryApp = initializeApp(
    app.options,
    "TaskManagerSecondary"
  );

  secondaryAuth = getAuth(
    secondaryApp
  );

} catch (error) {

  console.warn(
    "Secondary Firebase app initialization:",
    error
  );

}


// ============================================================
// GLOBAL STATE
// ============================================================

const state = {

  user: null,

  profile: null,

  users: [],

  tasks: [],

  currentPage: "dashboard",

  selectedStudentId: null

};


// ============================================================
// SHORTCUT
// ============================================================

const $ = (id) =>
  document.getElementById(id);


// ============================================================
// SHOW / HIDE
// ============================================================

function show(id) {

  const el = $(id);

  if (el) {
    el.classList.remove("hidden");
  }

}


function hide(id) {

  const el = $(id);

  if (el) {
    el.classList.add("hidden");
  }

}


// ============================================================
// LOADER
// ============================================================

function hideLoader() {

  const loader =
    $("appLoader");

  if (!loader) {
    return;
  }

  loader.style.opacity = "0";

  loader.style.pointerEvents =
    "none";

  setTimeout(() => {

    loader.remove();

  }, 250);

}


// ============================================================
// TOAST
// ============================================================

let toastTimer = null;

function toast(
  msg,
  type = "success"
) {

  const box =
    $("toast");

  const text =
    $("toastMessage");

  const icon =
    $("toastIcon");

  if (!box || !text) {
    return;
  }

  text.textContent =
    msg;

  if (icon) {

    icon.textContent =
      type === "error"
        ? "!"
        : type === "warning"
        ? "!"
        : "✓";

    icon.style.background =
      type === "error"
        ? "#dc2626"
        : type === "warning"
        ? "#f59e0b"
        : "#22c55e";

  }

  show("toast");

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {

      hide("toast");

    }, 3500);

}


// ============================================================
// MESSAGE
// ============================================================

function message(
  id,
  text,
  type = "error"
) {

  const el =
    $(id);

  if (!el) {
    return;
  }

  el.textContent =
    text;

  el.style.color =
    type === "success"
      ? "#15803d"
      : type === "warning"
      ? "#b45309"
      : "#dc2626";

}


// ============================================================
// FIREBASE ERROR HANDLER
// ============================================================

function firebaseError(error) {

  const code =
    error?.code || "";

  const errors = {

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/user-not-found":
      "No account was found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password must contain at least 6 characters.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "permission-denied":
      "You do not have permission for this action.",

    "auth/operation-not-allowed":
      "Email and password authentication is not enabled.",

    "auth/invalid-api-key":
      "Firebase configuration is invalid.",

    "failed-precondition":
      "This operation needs additional Firebase configuration."

  };

  return (
    errors[code] ||
    error?.message ||
    "Something went wrong. Please try again."
  );

}


// ============================================================
// LOGIN / REGISTER
// ============================================================

function showLogin() {

  show("loginPanel");

  hide("registerPanel");

  message(
    "loginMessage",
    ""
  );

  message(
    "registerMessage",
    ""
  );

}


function showRegister() {

  hide("loginPanel");

  show("registerPanel");

  message(
    "loginMessage",
    ""
  );

  message(
    "registerMessage",
    ""
  );

}


// ============================================================
// PASSWORD TOGGLE
// ============================================================

function setupPasswordToggles() {

  document
    .querySelectorAll(
      ".password-toggle"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const target =
            $(button.dataset.target);

          if (!target) {
            return;
          }

          if (
            target.type ===
            "password"
          ) {

            target.type =
              "text";

            button.textContent =
              "🙈";

            button.setAttribute(
              "aria-label",
              "Hide password"
            );

          } else {

            target.type =
              "password";

            button.textContent =
              "👁";

            button.setAttribute(
              "aria-label",
              "Show password"
            );

          }

        }
      );

    });

}


// ============================================================
// ADMIN REGISTRATION
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
      "Please enter your full name."
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

  if (
    password.length < 6
  ) {

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
    event.submitter ||
    document.querySelector(
      "#registerForm button[type='submit']"
    );

  if (button) {

    button.disabled =
      true;

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

    const firebaseUser =
      credential.user;

    await updateProfile(
      firebaseUser,
      {
        displayName:
          name
      }
    );

    await setDoc(
      doc(
        db,
        "users",
        firebaseUser.uid
      ),
      {

        uid:
          firebaseUser.uid,

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

    message(
      "registerMessage",
      "Account created successfully. You can now sign in.",
      "success"
    );

    toast(
      "Admin account created successfully."
    );

    $("registerForm")
      ?.reset();

    await signOut(
      auth
    );

    setTimeout(() => {

      showLogin();

    }, 1000);

  } catch (error) {

    console.error(
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
        "Create Account";

    }

  }

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

  if (
    !email ||
    !password
  ) {

    message(
      "loginMessage",
      "Please enter email and password."
    );

    return;
  }

  const button =
    event.submitter ||
    document.querySelector(
      "#loginForm button[type='submit']"
    );

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Signing In...";

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
        "Sign In";

    }

  }

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

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {

    throw new Error(
      "Your account profile was not found in the database."
    );

  }

  const data =
    snap.data();

  state.user =
    firebaseUser;

  state.profile = {

    ...data,

    uid:
      firebaseUser.uid

  };

  return state.profile;

}


// ============================================================
// START APPLICATION
// ============================================================

async function startApplication(
  firebaseUser
) {

  try {

    await loadProfile(
      firebaseUser
    );

    hide("authScreen");

    show("mainApp");

    updateUserInterface();

    await loadUsers();

    await loadTasks();

    updateDashboard();

    showPage(
      "dashboard"
    );

  } catch (error) {

    console.error(
      error
    );

    toast(
      firebaseError(error),
      "error"
    );

    await signOut(
      auth
    );

    show("authScreen");

    hide("mainApp");

  }

}


// ============================================================
// INITIALS
// ============================================================

function initials(
  name = "User"
) {

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      part =>
        part[0]
          ?.toUpperCase() ||
        ""
    )
    .join("") ||
    "U";

}


// ============================================================
// UPDATE USER INTERFACE
// ============================================================

function updateUserInterface() {

  const profile =
    state.profile;

  if (!profile) {
    return;
  }

  const name =
    profile.name ||
    state.user?.displayName ||
    "User";

  const role =
    profile.role ||
    "user";

  const avatar =
    initials(name);

  if ($("headerUserName"))
    $("headerUserName")
      .textContent =
      name;

  if ($("headerUserRole"))
    $("headerUserRole")
      .textContent =
      role;

  if ($("sidebarName"))
    $("sidebarName")
      .textContent =
      name;

  if ($("sidebarRole"))
    $("sidebarRole")
      .textContent =
      role;

  if ($("sidebarAvatar"))
    $("sidebarAvatar")
      .textContent =
      avatar;

  if ($("profileAvatar"))
    $("profileAvatar")
      .textContent =
      avatar;

  if ($("profileName"))
    $("profileName")
      .textContent =
      name;

  if ($("profileNameDetail"))
    $("profileNameDetail")
      .textContent =
      name;

  if ($("profileEmail"))
    $("profileEmail")
      .textContent =
        profile.email ||
        state.user?.email ||
        "—";

  if ($("profileRole"))
    $("profileRole")
      .textContent =
      role;

  if ($("profileRoleDetail"))
    $("profileRoleDetail")
      .textContent =
      role;

  if ($("profileStatus"))
    $("profileStatus")
      .textContent =
        profile.active === false
          ? "Inactive"
          : "Active";

  const isAdmin =
    role === "admin" ||
    role === "superadmin";

  document
    .querySelectorAll(
      ".admin-only"
    )
    .forEach(el => {

      if (isAdmin) {

        el.classList.remove(
          "hidden"
        );

      } else {

        el.classList.add(
          "hidden"
        );

      }

    });

  if ($("usersNavItem")) {

    $("usersNavItem")
      .classList.toggle(
        "hidden",
        !isAdmin
      );

  }

  if ($("progressNavItem")) {

    $("progressNavItem")
      .classList.toggle(
        "hidden",
        !isAdmin
      );

  }

  if ($("addUserBtn")) {

    $("addUserBtn")
      .classList.toggle(
        "hidden",
        !isAdmin
      );

  }

  if ($("addTaskBtn")) {

    $("addTaskBtn")
      .classList.toggle(
        "hidden",
        !isAdmin
      );

  }

}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function showPage(page) {

  const pages = [
    "dashboard",
    "users",
    "tasks",
    "progress",
    "profile"
  ];

  pages.forEach(
    name => {

      const pageElement =
        $(`${name}Page`);

      if (!pageElement) {
        return;
      }

      if (
        name === page
      ) {

        pageElement
          .classList
          .remove("hidden");

        pageElement
          .classList
          .add(
            "active-page"
          );

      } else {

        pageElement
          .classList
          .add("hidden");

        pageElement
          .classList
          .remove(
            "active-page"
          );

      }

    }
  );

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      item => {

        item.classList.toggle(
          "active",
          item.dataset.page ===
            page
        );

      }
    );

  state.currentPage =
    page;

  closeMobileSidebar();

  if (
    page ===
    "dashboard"
  ) {

    updateDashboard();

  }

  if (
    page ===
    "users"
  ) {

    renderUsers();

  }

  if (
    page ===
    "tasks"
  ) {

    renderTasks();

  }

  if (
    page ===
    "progress"
  ) {

    state.selectedStudentId =
      null;

    renderProgress();

  }

}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {

  if (!state.profile) {
    return;
  }

  const role =
    state.profile.role;

  try {

    let q;

    if (
      role ===
      "superadmin"
    ) {

      q =
        query(
          collection(
            db,
            "users"
          )
        );

    } else if (
      role ===
      "admin"
    ) {

      q =
        query(
          collection(
            db,
            "users"
          ),
          where(
            "role",
            "==",
            "student"
          ),
          where(
            "createdBy",
            "==",
            state.user.uid
          )
        );

    } else {

      state.users =
        [];

      return;

    }

    const snap =
      await getDocs(q);

    state.users =
      snap.docs.map(
        docSnap => ({

          id:
            docSnap.id,

          ...docSnap.data()

        })
      );

    state.users.sort(
      (a, b) => {

        if (
          a.role ===
          b.role
        ) {

          return (
            (a.name || "")
              .localeCompare(
                b.name || ""
              )
          );

        }

        if (
          a.role ===
          "superadmin"
        ) {
          return -1;
        }

        if (
          b.role ===
          "superadmin"
        ) {
          return 1;
        }

        if (
          a.role ===
          "admin"
        ) {
          return -1;
        }

        return 1;

      }
    );

  } catch (error) {

    console.error(
      "Users error:",
      error
    );

    state.users =
      [];

  }

}


// ============================================================
// LOAD TASKS
// ============================================================

async function loadTasks() {

  if (!state.profile) {
    return;
  }

  const role =
    state.profile.role;

  try {

    let q;

    if (
      role ===
      "superadmin"
    ) {

      q =
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

    } else if (
      role ===
      "admin"
    ) {

      q =
        query(
          collection(
            db,
            "tasks"
          ),
          where(
            "assignedBy",
            "==",
            state.user.uid
          )
        );

    } else {

      q =
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

    }

    const snap =
      await getDocs(q);

    state.tasks =
      snap.docs.map(
        docSnap => ({

          id:
            docSnap.id,

          ...docSnap.data()

        })
      );

    state.tasks.sort(
      (a, b) =>
        timestampValue(
          b.assignedAt
        ) -
        timestampValue(
          a.assignedAt
        )
    );

  } catch (error) {

    console.error(
      "Tasks error:",
      error
    );

    state.tasks =
      [];

  }

}


// ============================================================
// TIMESTAMP
// ============================================================

function timestampValue(
  timestamp
) {

  if (!timestamp) {
    return 0;
  }

  if (
    typeof timestamp.toMillis ===
    "function"
  ) {

    return timestamp.toMillis();

  }

  if (
    timestamp.seconds !==
    undefined
  ) {

    return (
      timestamp.seconds *
      1000
    );

  }

  if (
    timestamp instanceof Date
  ) {

    return timestamp.getTime();

  }

  return 0;

}


// ============================================================
// DATE
// ============================================================

function formatDate(
  timestamp
) {

  const value =
    timestampValue(
      timestamp
    );

  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString(
    undefined,
    {

      dateStyle:
        "medium",

      timeStyle:
        "short"

    }
  );

}


// ============================================================
// DURATION
// ============================================================

function formatDuration(
  ms
) {

  if (
    !ms ||
    ms < 0
  ) {

    return "—";

  }

  const totalSeconds =
    Math.floor(
      ms / 1000
    );

  const hours =
    Math.floor(
      totalSeconds /
      3600
    );

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) / 60
    );

  const seconds =
    totalSeconds %
    60;

  if (hours > 0) {

    return `${hours}h ${minutes}m`;

  }

  if (minutes > 0) {

    return `${minutes}m ${seconds}s`;

  }

  return `${seconds}s`;

}


// ============================================================
// STATUS
// ============================================================

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


function statusClass(
  status
) {

  return `status-${
    status ||
    "pending"
  }`;

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
        item.uid === uid ||
        item.id === uid
    );

  return (
    user?.name ||
    user?.email ||
    "User"
  );

}


// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard() {

  const tasks =
    state.tasks || [];

  const total =
    tasks.length;

  const pending =
    tasks.filter(
      t =>
        (
          t.status ||
          "pending"
        ) ===
        "pending"
    ).length;

  const inProgress =
    tasks.filter(
      t =>
        t.status ===
        "in_progress"
    ).length;

  const completed =
    tasks.filter(
      t =>
        t.status ===
        "completed"
    ).length;

  if ($("statTotalTasks"))
    $("statTotalTasks")
      .textContent =
      total;

  if ($("statPending"))
    $("statPending")
      .textContent =
      pending;

  if ($("statInProgress"))
    $("statInProgress")
      .textContent =
      inProgress;

  if ($("statCompleted"))
    $("statCompleted")
      .textContent =
      completed;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (
            completed /
            total
          ) * 100
        );

  if ($("overviewPercentage"))
    $("overviewPercentage")
      .textContent =
      `${percentage}%`;

  if ($("overviewProgress")) {

    $("overviewProgress")
      .style.background =
      `conic-gradient(
        #4f46e5
        ${percentage * 3.6}deg,
        #edf0f7
        ${percentage * 3.6}deg
      )`;

  }

  renderRecentTasks();

}


// ============================================================
// RECENT TASKS
// ============================================================

function renderRecentTasks() {

  const container =
    $("recentTasksContainer");

  if (!container) {
    return;
  }

  const tasks =
    state.tasks.slice(
      0,
      6
    );

  if (!tasks.length) {

    container.innerHTML =
      emptyHTML(
        "✓",
        "No tasks yet",
        "Tasks will appear here."
      );

    return;

  }

  container.innerHTML =
    tasks
      .map(taskHTML)
      .join("");

}


// ============================================================
// TASK HTML
// ============================================================

function taskHTML(
  task
) {

  const status =
    task.status ||
    "pending";

  const assignedTo =
    getUserName(
      task.assignedTo
    );

  const duration =
    task.durationMs
      ? formatDuration(
          task.durationMs
        )
      : "Not completed";

  return `

    <div class="task-item">

      <div class="task-main">

        <div class="task-title">
          ${escapeHTML(
            task.title ||
            "Untitled Task"
          )}
        </div>

        <div class="task-description">
          ${escapeHTML(
            task.description ||
            "No description"
          )}
        </div>

        <div class="task-meta">

          <span>
            ${escapeHTML(
              assignedTo
            )}
          </span>

          <span>•</span>

          <span>
            Assigned
            ${escapeHTML(
              formatDate(
                task.assignedAt
              )
            )}
          </span>

          ${
            task.acceptedAt
              ? `
                <span>•</span>
                <span>
                  Accepted
                  ${escapeHTML(
                    formatDate(
                      task.acceptedAt
                    )
                  )}
                </span>
              `
              : ""
          }

          ${
            task.startedAt
              ? `
                <span>•</span>
                <span>
                  Started
                  ${escapeHTML(
                    formatDate(
                      task.startedAt
                    )
                  )}
                </span>
              `
              : ""
          }

          ${
            task.completedAt
              ? `
                <span>•</span>
                <span>
                  Completed
                  ${escapeHTML(
                    formatDate(
                      task.completedAt
                    )
                  )}
                </span>

                <span>•</span>

                <span>
                  Duration:
                  ${escapeHTML(
                    duration
                  )}
                </span>
              `
              : ""
          }

        </div>

      </div>

      <div class="task-actions">

        <span
          class="
            status-badge
            ${statusClass(status)}
          "
        >
          ${statusLabel(status)}
        </span>

        ${taskActionButtons(
          task
        )}

      </div>

    </div>

  `;

}


// ============================================================
// STUDENT TASK BUTTONS
// ============================================================

function taskActionButtons(
  task
) {

  const role =
    state.profile?.role;

  const status =
    task.status ||
    "pending";

  if (
    role !==
    "student"
  ) {

    return "";

  }

  if (
    status ===
    "pending"
  ) {

    return `

      <button
        class="small-btn"
        data-task-action="accept"
        data-task-id="${task.id}"
        type="button"
      >
        Accept
      </button>

    `;

  }

  if (
    status ===
    "accepted"
  ) {

    return `

      <button
        class="small-btn"
        data-task-action="start"
        data-task-id="${task.id}"
        type="button"
      >
        Start
      </button>

    `;

  }

  if (
    status ===
    "in_progress"
  ) {

    return `

      <button
        class="small-btn"
        data-task-action="complete"
        data-task-id="${task.id}"
        type="button"
      >
        Complete
      </button>

    `;

  }

  return "";

}


// ============================================================
// ACCEPT TASK
// ============================================================

async function acceptTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id ===
        taskId
    );

  if (!task) {
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

    toast(
      "Task accepted."
    );

    await loadTasks();

    updateDashboard();

    if (
      state.currentPage ===
      "tasks"
    ) {

      renderTasks();

    }

  } catch (error) {

    console.error(
      error
    );

    toast(
      firebaseError(error),
      "error"
    );

  }

}


// ============================================================
// START TASK
// ============================================================

async function startTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id ===
        taskId
    );

  if (!task) {
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

    toast(
      "Task started."
    );

    await loadTasks();

    updateDashboard();

    if (
      state.currentPage ===
      "tasks"
    ) {

      renderTasks();

    }

  } catch (error) {

    console.error(
      error
    );

    toast(
      firebaseError(error),
      "error"
    );

  }

}


// ============================================================
// COMPLETE TASK
// ============================================================

async function completeTask(
  taskId
) {

  const task =
    state.tasks.find(
      item =>
        item.id ===
        taskId
    );

  if (!task) {
    return;
  }

  try {

    const completedAt =
      Date.now();

    const startedAt =
      timestampValue(
        task.startedAt
      );

    const durationMs =
      startedAt
        ? Math.max(
            0,
            completedAt -
            startedAt
          )
        : 0;

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

    toast(
      "Task completed successfully."
    );

    await loadTasks();

    updateDashboard();

    if (
      state.currentPage ===
      "tasks"
    ) {

      renderTasks();

    }

  } catch (error) {

    console.error(
      error
    );

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
    $("allTasksContainer");

  if (!container) {
    return;
  }

  const search =
    $("taskSearch")
      ?.value
      .trim()
      .toLowerCase() ||
    "";

  const filter =
    $("taskStatusFilter")
      ?.value ||
    "all";

  let tasks =
    [
      ...state.tasks
    ];

  if (search) {

    tasks =
      tasks.filter(
        task => {

          const text =
            `${
              task.title ||
              ""
            } ${
              task.description ||
              ""
            }`.toLowerCase();

          return text.includes(
            search
          );

        }
      );

  }

  if (
    filter !==
    "all"
  ) {

    tasks =
      tasks.filter(
        task =>
          (
            task.status ||
            "pending"
          ) ===
          filter
      );

  }

  if (!tasks.length) {

    container.innerHTML =
      emptyHTML(
        "✓",
        "No tasks found",
        "There are no tasks matching your search."
      );

    return;

  }

  container.innerHTML =
    tasks
      .map(taskHTML)
      .join("");

}


// ============================================================
// USERS PAGE
// ============================================================

function renderUsers() {

  const container =
    $("usersContainer");

  if (!container) {
    return;
  }

  if (!state.users.length) {

    container.innerHTML = `

      <div class="empty-state full-width">

        <div class="empty-icon">
          👥
        </div>

        <h4>
          No users found
        </h4>

        <p>
          Create your first user to assign tasks.
        </p>

      </div>

    `;

    return;

  }

  const role =
    state.profile?.role;

  // ----------------------------------------------------------
  // SUPER ADMIN: SHOW ADMINS + THEIR STUDENTS
  // ----------------------------------------------------------

  if (
    role ===
    "superadmin"
  ) {

    const admins =
      state.users.filter(
        user =>
          user.role ===
          "admin"
      );

    const students =
      state.users.filter(
        user =>
          user.role ===
          "student"
      );

    let html = "";

    // Super admin card
    html += `

      <div
        style="
          grid-column:1/-1;
          padding:18px;
          border-radius:16px;
          background:#f7f7ff;
          border:1px solid #e6e7f2;
          margin-bottom:4px;
        "
      >

        <strong
          style="
            color:#1d2939;
            font-size:16px;
          "
        >
          Super Admin Monitoring
        </strong>

        <div
          style="
            margin-top:6px;
            color:#667085;
            font-size:12px;
          "
        >
          ${admins.length}
          admin${admins.length === 1 ? "" : "s"}
          •
          ${students.length}
          student${students.length === 1 ? "" : "s"}
          •
          ${state.tasks.length}
          total task${state.tasks.length === 1 ? "" : "s"}
        </div>

      </div>

    `;

    if (!admins.length) {

      html += `

        <div
          class="empty-state full-width"
          style="grid-column:1/-1"
        >

          <div class="empty-icon">
            👨‍💼
          </div>

          <h4>
            No Admins Found
          </h4>

          <p>
            Registered admins will appear here.
          </p>

        </div>

      `;

    } else {

      admins.forEach(
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
                  (
                    completed /
                    adminTasks.length
                  ) * 100
                )
              : 0;

          html += `

            <div
              style="
                grid-column:1/-1;
                padding:20px;
                border-radius:18px;
                background:#fff;
                border:1px solid #e8eaf1;
                box-shadow:0 6px 20px rgba(16,24,40,.05);
                margin-bottom:4px;
              "
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:flex-start;
                  gap:15px;
                  flex-wrap:wrap;
                "
              >

                <div
                  style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                  "
                >

                  <div
                    style="
                      width:48px;
                      height:48px;
                      border-radius:14px;
                      background:#eef0ff;
                      color:#4f46e5;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      font-weight:800;
                    "
                  >
                    ${escapeHTML(
                      initials(
                        admin.name ||
                        admin.email ||
                        "Admin"
                      )
                    )}
                  </div>

                  <div>

                    <div
                      style="
                        font-size:16px;
                        font-weight:800;
                        color:#1d2939;
                      "
                    >
                      ${escapeHTML(
                        admin.name ||
                        "Admin"
                      )}
                    </div>

                    <div
                      style="
                        margin-top:3px;
                        font-size:12px;
                        color:#667085;
                      "
                    >
                      ${escapeHTML(
                        admin.email ||
                        "No email"
                      )}
                    </div>

                  </div>

                </div>

                <span
                  class="
                    status-badge
                    status-completed
                  "
                >
                  Admin
                </span>

              </div>

              <div
                style="
                  display:grid;
                  grid-template-columns:
                    repeat(
                      auto-fit,
                      minmax(120px,1fr)
                    );
                  gap:10px;
                  margin-top:18px;
                "
              >

                <div
                  style="
                    padding:13px;
                    background:#f8f9fc;
                    border-radius:12px;
                  "
                >
                  <strong
                    style="
                      display:block;
                      font-size:20px;
                      color:#1d2939;
                    "
                  >
                    ${adminStudents.length}
                  </strong>
                  <span
                    style="
                      font-size:11px;
                      color:#667085;
                    "
                  >
                    Users Created
                  </span>
                </div>

                <div
                  style="
                    padding:13px;
                    background:#f8f9fc;
                    border-radius:12px;
                  "
                >
                  <strong
                    style="
                      display:block;
                      font-size:20px;
                      color:#1d2939;
                    "
                  >
                    ${adminTasks.length}
                  </strong>
                  <span
                    style="
                      font-size:11px;
                      color:#667085;
                    "
                  >
                    Tasks Assigned
                  </span>
                </div>

                <div
                  style="
                    padding:13px;
                    background:#f8f9fc;
                    border-radius:12px;
                  "
                >
                  <strong
                    style="
                      display:block;
                      font-size:20px;
                      color:#1d2939;
                    "
                  >
                    ${completed}
                  </strong>
                  <span
                    style="
                      font-size:11px;
                      color:#667085;
                    "
                  >
                    Completed
                  </span>
                </div>

                <div
                  style="
                    padding:13px;
                    background:#f8f9fc;
                    border-radius:12px;
                  "
                >
                  <strong
                    style="
                      display:block;
                      font-size:20px;
                      color:#1d2939;
                    "
                  >
                    ${progress}%
                  </strong>
                  <span
                    style="
                      font-size:11px;
                      color:#667085;
                    "
                  >
                    Progress
                  </span>
                </div>

              </div>

              <div
                style="
                  margin-top:18px;
                  padding-top:16px;
                  border-top:1px solid #edf0f5;
                "
              >

                <div
                  style="
                    font-size:13px;
                    font-weight:800;
                    color:#344054;
                    margin-bottom:10px;
                  "
                >
                  Students Created By This Admin
                </div>

                ${
                  adminStudents.length
                    ? adminStudents
                        .map(
                          student => {

                            const studentTasks =
                              state.tasks.filter(
                                task =>
                                  task.assignedTo ===
                                  student.uid
                              );

                            const studentCompleted =
                              studentTasks.filter(
                                task =>
                                  task.status ===
                                  "completed"
                              ).length;

                            const studentProgress =
                              studentTasks.length
                                ? Math.round(
                                    (
                                      studentCompleted /
                                      studentTasks.length
                                    ) * 100
                                  )
                                : 0;

                            return `

                              <div
                                data-user-progress="${student.uid}"
                                style="
                                  cursor:pointer;
                                  display:flex;
                                  align-items:center;
                                  justify-content:space-between;
                                  gap:10px;
                                  padding:12px;
                                  border-radius:12px;
                                  background:#fafbff;
                                  border:1px solid #eef0f5;
                                  margin-bottom:8px;
                                "
                                title="Click to view detailed progress"
                              >

                                <div
                                  style="
                                    display:flex;
                                    align-items:center;
                                    gap:10px;
                                    min-width:0;
                                  "
                                >

                                  <div
                                    style="
                                      width:36px;
                                      height:36px;
                                      flex-shrink:0;
                                      border-radius:10px;
                                      background:#eef0ff;
                                      color:#4f46e5;
                                      display:flex;
                                      align-items:center;
                                      justify-content:center;
                                      font-size:12px;
                                      font-weight:800;
                                    "
                                  >
                                    ${escapeHTML(
                                      initials(
                                        student.name ||
                                        student.email ||
                                        "User"
                                      )
                                    )}
                                  </div>

                                  <div
                                    style="
                                      min-width:0;
                                    "
                                  >

                                    <div
                                      style="
                                        font-size:12px;
                                        font-weight:800;
                                        color:#344054;
                                      "
                                    >
                                      ${escapeHTML(
                                        student.name ||
                                        "Student"
                                      )}
                                    </div>

                                    <div
                                      style="
                                        font-size:10px;
                                        color:#667085;
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                      "
                                    >
                                      ${escapeHTML(
                                        student.email ||
                                        ""
                                      )}
                                    </div>

                                  </div>

                                </div>

                                <div
                                  style="
                                    text-align:right;
                                    flex-shrink:0;
                                  "
                                >

                                  <strong
                                    style="
                                      color:#4f46e5;
                                      font-size:13px;
                                    "
                                  >
                                    ${studentProgress}%
                                  </strong>

                                  <div
                                    style="
                                      font-size:9px;
                                      color:#667085;
                                    "
                                  >
                                    ${studentTasks.length}
                                    tasks
                                  </div>

                                </div>

                              </div>

                            `;

                          }
                        )
                        .join("")
                    : `
                      <div
                        style="
                          padding:14px;
                          color:#98a2b3;
                          font-size:12px;
                          background:#fafafa;
                          border-radius:10px;
                        "
                      >
                        This admin has not created any students yet.
                      </div>
                    `
                }

              </div>

            </div>

          `;

        }
      );

    }

    container.innerHTML =
      html;

    return;

  }


  // ----------------------------------------------------------
  // NORMAL ADMIN / STUDENT VIEW
  // ----------------------------------------------------------

  container.innerHTML =
    state.users
      .map(
        user => {

          const userTasks =
            state.tasks.filter(
              task =>
                task.assignedTo ===
                user.uid
            );

          const total =
            userTasks.length;

          const completed =
            userTasks.filter(
              task =>
                task.status ===
                "completed"
            ).length;

          const progress =
            total
              ? Math.round(
                  (
                    completed /
                    total
                  ) * 100
                )
              : 0;

          const roleLabel =
            user.role ===
            "superadmin"
              ? "Super Admin"
              : user.role ===
                "admin"
              ? "Admin"
              : "Student";

          return `

            <div
              class="user-card"
              data-user-progress="${
                user.uid
              }"
              style="
                cursor:pointer;
              "
              title="Click to view detailed progress"
            >

              <div class="user-card-top">

                <div class="user-card-avatar">
                  ${escapeHTML(
                    initials(
                      user.name ||
                      user.email ||
                      "U"
                    )
                  )}
                </div>

                <div class="user-card-name">

                  <strong>
                    ${escapeHTML(
                      user.name ||
                      "Unnamed User"
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      user.email ||
                      "No email"
                    )}
                  </span>

                </div>

              </div>

              <div class="user-card-stats">

                <div class="user-mini-stat">
                  <strong>
                    ${total}
                  </strong>
                  <span>
                    Tasks
                  </span>
                </div>

                <div class="user-mini-stat">
                  <strong>
                    ${completed}
                  </strong>
                  <span>
                    Done
                  </span>
                </div>

                <div class="user-mini-stat">
                  <strong>
                    ${progress}%
                  </strong>
                  <span>
                    Progress
                  </span>
                </div>

              </div>

              <div
                class="user-card-footer"
              >

                <span
                  class="
                    status-badge
                    ${
                      user.active === false
                        ? "status-pending"
                        : "status-completed"
                    }
                  "
                >
                  ${
                    user.active === false
                      ? "Inactive"
                      : "Active"
                  }
                </span>

                <span
                  style="
                    color:#667085;
                    font-size:10px;
                    font-weight:600;
                  "
                >
                  ${roleLabel}
                </span>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// PROGRESS DATA
// ============================================================

function getStudentProgress(
  user
) {

  const tasks =
    state.tasks.filter(
      task =>
        task.assignedTo ===
        user.uid
    );

  const total =
    tasks.length;

  const pending =
    tasks.filter(
      task =>
        (
          task.status ||
          "pending"
        ) ===
        "pending"
    ).length;

  const accepted =
    tasks.filter(
      task =>
        task.status ===
        "accepted"
    ).length;

  const inProgress =
    tasks.filter(
      task =>
        task.status ===
        "in_progress"
    ).length;

  const completed =
    tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  const percentage =
    total
      ? Math.round(
          (
            completed /
            total
          ) * 100
        )
      : 0;

  return {

    user,

    tasks,

    total,

    pending,

    accepted,

    inProgress,

    completed,

    percentage

  };

}


// ============================================================
// ALL STUDENTS GRAPH
// ============================================================

function renderAllStudentsGraph(
  students
) {

  const data =
    students.map(
      user =>
        getStudentProgress(
          user
        )
    );

  const bars =
    data.map(
      item => {

        const height =
          Math.max(
            item.percentage,
            4
          );

        return `

          <div
            style="
              flex:1;
              min-width:58px;
              max-width:100px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:flex-end;
              height:235px;
            "
          >

            <div
              style="
                font-size:11px;
                font-weight:800;
                color:#4f46e5;
                margin-bottom:6px;
              "
            >
              ${item.percentage}%
            </div>

            <div
              style="
                width:58%;
                max-width:55px;
                height:${height * 1.55}px;
                max-height:160px;
                min-height:7px;
                border-radius:10px 10px 4px 4px;
                background:
                  linear-gradient(
                    180deg,
                    #6366f1,
                    #4f46e5
                  );
                box-shadow:
                  0 6px 14px
                  rgba(79,70,229,.18);
              "
            ></div>

            <div
              style="
                width:100%;
                margin-top:10px;
                text-align:center;
                font-size:10px;
                font-weight:700;
                color:#667085;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
                padding:0 4px;
              "
              title="${escapeHTML(
                item.user.name ||
                item.user.email ||
                "Student"
              )}"
            >
              ${escapeHTML(
                item.user.name ||
                "Student"
              )}
            </div>

          </div>

        `;

      }
    )
    .join("");

  return `

    <div
      style="
        width:100%;
        margin-bottom:20px;
        padding:20px;
        border-radius:18px;
        background:#ffffff;
        border:1px solid #e8eaf1;
        box-shadow:0 8px 24px rgba(16,24,40,.05);
      "
    >

      <div
        style="
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          margin-bottom:18px;
          flex-wrap:wrap;
        "
      >

        <div>

          <h3
            style="
              margin:0;
              color:#1d2939;
              font-size:17px;
              font-weight:800;
            "
          >
            All Users Progress
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#667085;
              font-size:12px;
            "
          >
            Overall completed-task progress for every student.
          </p>

        </div>

        <div
          style="
            font-size:11px;
            color:#667085;
            font-weight:700;
          "
        >
          ${students.length}
          student${students.length === 1 ? "" : "s"}
        </div>

      </div>

      <div
        style="
          display:flex;
          align-items:flex-end;
          gap:12px;
          overflow-x:auto;
          min-height:260px;
          padding:20px 10px 5px;
          border-radius:14px;
          background:
            repeating-linear-gradient(
              to top,
              #f4f5f9 0px,
              #f4f5f9 1px,
              transparent 1px,
              transparent 52px
            );
        "
      >

        ${bars}

      </div>

    </div>

  `;

}


// ============================================================
// INDIVIDUAL STUDENT PROGRESS
// ============================================================

function renderIndividualProgress(
  user
) {

  const data =
    getStudentProgress(
      user
    );

  const completedPercent =
    data.percentage;

  const remainingPercent =
    Math.max(
      0,
      100 -
      completedPercent
    );

  const tasks =
    data.tasks;

  const taskRows =
    tasks.length
      ? tasks
          .map(
            task => `

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:12px;
                  padding:12px 0;
                  border-bottom:1px solid #edf0f5;
                "
              >

                <div
                  style="
                    min-width:0;
                  "
                >

                  <div
                    style="
                      font-size:12px;
                      font-weight:800;
                      color:#344054;
                    "
                  >
                    ${escapeHTML(
                      task.title ||
                      "Untitled Task"
                    )}
                  </div>

                  <div
                    style="
                      margin-top:3px;
                      font-size:10px;
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

                <span
                  class="
                    status-badge
                    ${statusClass(
                      task.status ||
                      "pending"
                    )}
                  "
                >
                  ${statusLabel(
                    task.status ||
                    "pending"
                  )}
                </span>

              </div>

            `
          )
          .join("")
      : `

          <div
            style="
              padding:18px;
              text-align:center;
              color:#98a2b3;
              font-size:12px;
            "
          >
            No tasks assigned to this user yet.
          </div>

        `;

  return `

    <div
      style="
        width:100%;
        margin-bottom:20px;
        padding:20px;
        border-radius:18px;
        background:#ffffff;
        border:1px solid #e8eaf1;
        box-shadow:0 8px 24px rgba(16,24,40,.05);
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:20px;
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:12px;
          "
        >

          <div
            style="
              width:48px;
              height:48px;
              border-radius:14px;
              background:#eef0ff;
              color:#4f46e5;
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:800;
            "
          >
            ${escapeHTML(
              initials(
                user.name ||
                user.email ||
                "User"
              )
            )}
          </div>

          <div>

            <h3
              style="
                margin:0;
                font-size:17px;
                font-weight:800;
                color:#1d2939;
              "
            >
              ${escapeHTML(
                user.name ||
                "Student"
              )}
            </h3>

            <div
              style="
                margin-top:3px;
                font-size:11px;
                color:#667085;
              "
            >
              ${escapeHTML(
                user.email ||
                ""
              )}
            </div>

          </div>

        </div>

        <button
          type="button"
          data-close-student-progress="true"
          class="small-btn"
        >
          ← All Users
        </button>

      </div>


      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(120px,1fr)
            );
          gap:10px;
          margin-bottom:20px;
        "
      >

        <div
          style="
            padding:14px;
            border-radius:12px;
            background:#f8f9fc;
          "
        >
          <strong
            style="
              display:block;
              font-size:22px;
              color:#1d2939;
            "
          >
            ${data.total}
          </strong>

          <span
            style="
              font-size:10px;
              color:#667085;
            "
          >
            Total Tasks
          </span>
        </div>


        <div
          style="
            padding:14px;
            border-radius:12px;
            background:#f8f9fc;
          "
        >
          <strong
            style="
              display:block;
              font-size:22px;
              color:#15803d;
            "
          >
            ${data.completed}
          </strong>

          <span
            style="
              font-size:10px;
              color:#667085;
            "
          >
            Completed
          </span>
        </div>


        <div
          style="
            padding:14px;
            border-radius:12px;
            background:#f8f9fc;
          "
        >
          <strong
            style="
              display:block;
              font-size:22px;
              color:#4f46e5;
            "
          >
            ${data.inProgress}
          </strong>

          <span
            style="
              font-size:10px;
              color:#667085;
            "
          >
            In Progress
          </span>
        </div>


        <div
          style="
            padding:14px;
            border-radius:12px;
            background:#f8f9fc;
          "
        >
          <strong
            style="
              display:block;
              font-size:22px;
              color:#b45309;
            "
          >
            ${data.pending}
          </strong>

          <span
            style="
              font-size:10px;
              color:#667085;
            "
          >
            Pending
          </span>
        </div>


        <div
          style="
            padding:14px;
            border-radius:12px;
            background:#f8f9fc;
          "
        >
          <strong
            style="
              display:block;
              font-size:22px;
              color:#4f46e5;
            "
          >
            ${data.percentage}%
          </strong>

          <span
            style="
              font-size:10px;
              color:#667085;
            "
          >
            Completion
          </span>
        </div>

      </div>


      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px,1fr)
            );
          gap:18px;
          align-items:center;
        "
      >

        <div
          style="
            display:flex;
            justify-content:center;
            align-items:center;
            min-height:210px;
          "
        >

          <div
            style="
              width:170px;
              height:170px;
              border-radius:50%;
              background:
                conic-gradient(
                  #4f46e5
                  ${completedPercent * 3.6}deg,
                  #edf0f7
                  ${completedPercent * 3.6}deg
                );
              display:flex;
              align-items:center;
              justify-content:center;
            "
          >

            <div
              style="
                width:125px;
                height:125px;
                border-radius:50%;
                background:#fff;
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
              "
            >

              <strong
                style="
                  font-size:30px;
                  color:#1d2939;
                "
              >
                ${completedPercent}%
              </strong>

              <span
                style="
                  font-size:10px;
                  color:#667085;
                "
              >
                Completed
              </span>

            </div>

          </div>

        </div>


        <div>

          <h4
            style="
              margin:0 0 12px;
              font-size:14px;
              color:#344054;
            "
          >
            Task Progress
          </h4>

          <div
            style="
              display:grid;
              gap:9px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                font-size:11px;
                color:#667085;
              "
            >
              <span>
                Completed
              </span>
              <strong>
                ${data.completed}
              </strong>
            </div>

            <div
              style="
                height:7px;
                background:#edf0f7;
                border-radius:20px;
                overflow:hidden;
              "
            >
              <div
                style="
                  height:100%;
                  width:${
                    data.total
                      ? (
                          data.completed /
                          data.total
                        ) * 100
                      : 0
                  }%;
                  background:#4f46e5;
                  border-radius:20px;
                "
              ></div>
            </div>


            <div
              style="
                display:flex;
                justify-content:space-between;
                font-size:11px;
                color:#667085;
              "
            >
              <span>
                In Progress
              </span>
              <strong>
                ${data.inProgress}
              </strong>
            </div>

            <div
              style="
                height:7px;
                background:#edf0f7;
                border-radius:20px;
                overflow:hidden;
              "
            >
              <div
                style="
                  height:100%;
                  width:${
                    data.total
                      ? (
                          data.inProgress /
                          data.total
                        ) * 100
                      : 0
                  }%;
                  background:#6366f1;
                  border-radius:20px;
                "
              ></div>
            </div>


            <div
              style="
                display:flex;
                justify-content:space-between;
                font-size:11px;
                color:#667085;
              "
            >
              <span>
                Accepted
              </span>
              <strong>
                ${data.accepted}
              </strong>
            </div>

            <div
              style="
                height:7px;
                background:#edf0f7;
                border-radius:20px;
                overflow:hidden;
              "
            >
              <div
                style="
                  height:100%;
                  width:${
                    data.total
                      ? (
                          data.accepted /
                          data.total
                        ) * 100
                      : 0
                  }%;
                  background:#8b5cf6;
                  border-radius:20px;
                "
              ></div>
            </div>


            <div
              style="
                display:flex;
                justify-content:space-between;
                font-size:11px;
                color:#667085;
              "
            >
              <span>
                Pending
              </span>
              <strong>
                ${data.pending}
              </strong>
            </div>

            <div
              style="
                height:7px;
                background:#edf0f7;
                border-radius:20px;
                overflow:hidden;
              "
            >
              <div
                style="
                  height:100%;
                  width:${
                    data.total
                      ? (
                          data.pending /
                          data.total
                        ) * 100
                      : 0
                  }%;
                  background:#f59e0b;
                  border-radius:20px;
                "
              ></div>
            </div>

          </div>

        </div>

      </div>

    </div>


    <div
      style="
        width:100%;
        padding:20px;
        border-radius:18px;
        background:#ffffff;
        border:1px solid #e8eaf1;
        box-shadow:0 8px 24px rgba(16,24,40,.05);
      "
    >

      <h3
        style="
          margin:0 0 12px;
          font-size:16px;
          color:#1d2939;
        "
      >
        ${escapeHTML(
          user.name ||
          "Student"
        )}'s Tasks
      </h3>

      ${taskRows}

    </div>

  `;

}


// ============================================================
// PROGRESS PAGE
// ============================================================

function renderProgress() {

  const container =
    $("progressSummary");

  if (!container) {
    return;
  }

  const role =
    state.profile?.role;

  const students =
    state.users.filter(
      user =>
        user.role ===
        "student"
    );

  // ----------------------------------------------------------
  // INDIVIDUAL STUDENT
  // ----------------------------------------------------------

  if (
    state.selectedStudentId
  ) {

    const selectedUser =
      students.find(
        user =>
          user.uid ===
          state.selectedStudentId
      );

    if (selectedUser) {

      container.innerHTML =
        renderIndividualProgress(
          selectedUser
        );

      return;

    }

    state.selectedStudentId =
      null;

  }


  // ----------------------------------------------------------
  // NO STUDENTS
  // ----------------------------------------------------------

  if (!students.length) {

    container.innerHTML =
      emptyHTML(
        "▥",
        "No progress data",
        "Create users and assign tasks to see progress."
      );

    return;

  }


  // ----------------------------------------------------------
  // ALL STUDENTS GRAPH
  // ----------------------------------------------------------

  let html =
    renderAllStudentsGraph(
      students
    );


  // ----------------------------------------------------------
  // STUDENT CARDS
  // ----------------------------------------------------------

  html += `

    <div
      style="
        margin-top:4px;
        margin-bottom:12px;
        font-size:14px;
        font-weight:800;
        color:#344054;
      "
    >
      Student Progress
    </div>

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(210px,1fr)
          );
        gap:14px;
      "
    >

      ${students
        .map(
          user => {

            const data =
              getStudentProgress(
                user
              );

            return `

              <div
                data-user-progress="${user.uid}"
                style="
                  cursor:pointer;
                  padding:17px;
                  border-radius:16px;
                  background:#fff;
                  border:1px solid #e8eaf1;
                  box-shadow:
                    0 5px 18px
                    rgba(16,24,40,.04);
                  transition:
                    transform .15s ease,
                    box-shadow .15s ease;
                "
                title="Click to view detailed progress"
              >

                <div
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:10px;
                  "
                >

                  <div
                    style="
                      display:flex;
                      align-items:center;
                      gap:9px;
                      min-width:0;
                    "
                  >

                    <div
                      style="
                        width:38px;
                        height:38px;
                        flex-shrink:0;
                        border-radius:11px;
                        background:#eef0ff;
                        color:#4f46e5;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:11px;
                        font-weight:800;
                      "
                    >
                      ${escapeHTML(
                        initials(
                          user.name ||
                          user.email ||
                          "User"
                        )
                      )}
                    </div>

                    <div
                      style="
                        min-width:0;
                      "
                    >

                      <div
                        style="
                          font-size:12px;
                          font-weight:800;
                          color:#344054;
                          overflow:hidden;
                          text-overflow:ellipsis;
                          white-space:nowrap;
                        "
                      >
                        ${escapeHTML(
                          user.name ||
                          "Student"
                        )}
                      </div>

                      <div
                        style="
                          font-size:10px;
                          color:#667085;
                          overflow:hidden;
                          text-overflow:ellipsis;
                          white-space:nowrap;
                        "
                      >
                        ${escapeHTML(
                          user.email ||
                          ""
                        )}
                      </div>

                    </div>

                  </div>

                  <strong
                    style="
                      color:#4f46e5;
                      font-size:14px;
                    "
                  >
                    ${data.percentage}%
                  </strong>

                </div>


                <div
                  style="
                    height:8px;
                    margin-top:15px;
                    background:#edf0f7;
                    border-radius:20px;
                    overflow:hidden;
                  "
                >

                  <div
                    style="
                      height:100%;
                      width:${data.percentage}%;
                      background:
                        linear-gradient(
                          90deg,
                          #6366f1,
                          #4f46e5
                        );
                      border-radius:20px;
                    "
                  ></div>

                </div>


                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    gap:5px;
                    margin-top:10px;
                    font-size:10px;
                    color:#667085;
                  "
                >

                  <span>
                    ${data.completed}
                    completed
                  </span>

                  <span>
                    ${data.total}
                    total
                  </span>

                </div>


                <div
                  style="
                    margin-top:10px;
                    font-size:9px;
                    font-weight:700;
                    color:#4f46e5;
                    text-align:right;
                  "
                >
                  Click for detailed graph →
                </div>

              </div>

            `;

          }
        )
        .join("")}

    </div>

  `;


  // ----------------------------------------------------------
  // SUPER ADMIN INFORMATION
  // ----------------------------------------------------------

  if (
    role ===
    "superadmin"
  ) {

    const admins =
      state.users.filter(
        user =>
          user.role ===
          "admin"
      );

    html += `

      <div
        style="
          margin-top:20px;
          padding:20px;
          border-radius:18px;
          background:#fff;
          border:1px solid #e8eaf1;
          box-shadow:
            0 8px 24px
            rgba(16,24,40,.05);
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            flex-wrap:wrap;
            margin-bottom:15px;
          "
        >

          <div>

            <h3
              style="
                margin:0;
                font-size:16px;
                color:#1d2939;
                font-weight:800;
              "
            >
              Admin Monitoring
            </h3>

            <p
              style="
                margin:5px 0 0;
                font-size:11px;
                color:#667085;
              "
            >
              Admin accounts, users created and tasks assigned.
            </p>

          </div>

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

          ${
            admins.length
              ? admins
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

                            </div>

                            <span
                              class="
                                status-badge
                                status-completed
                              "
                            >
                              Admin
                            </span>

                          </div>


                          <div
                            style="
                              display:grid;
                              grid-template-columns:
                                repeat(
                                  3,
                                  1fr
                                );
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
                                Users
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

                        </div>

                      `;

                    }
                  )
                  .join("")
              : `
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
                `
          }

        </div>

      </div>

    `;

  }


  container.innerHTML =
    html;

}


// ============================================================
// EMPTY HTML
// ============================================================

function emptyHTML(
  icon,
  title,
  description
) {

  return `

    <div class="empty-state">

      <div class="empty-icon">
        ${icon}
      </div>

      <h4>
        ${escapeHTML(title)}
      </h4>

      <p>
        ${escapeHTML(
          description
        )}
      </p>

    </div>

  `;

}


// ============================================================
// USER MODAL
// ============================================================

function openUserModal() {

  if (
    state.profile?.role !==
      "admin" &&
    state.profile?.role !==
      "superadmin"
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
    state.profile?.role !==
      "admin" &&
    state.profile?.role !==
      "superadmin"
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
      .trim();

  const password =
    $("userPassword")
      ?.value;

  const confirmPassword =
    $("userConfirmPassword")
      ?.value;

  message(
    "userMessage",
    ""
  );

  if (!name) {

    message(
      "userMessage",
      "Please enter the user's name."
    );

    return;

  }

  if (!email) {

    message(
      "userMessage",
      "Please enter the user's email."
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

  if (
    password !==
    confirmPassword
  ) {

    message(
      "userMessage",
      "Passwords do not match."
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
          state.profile.name ||
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
      "User created successfully.",
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

    setTimeout(() => {

      closeUserModal();

    }, 900);

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
    state.profile?.role !==
      "admin" &&
    state.profile?.role !==
      "superadmin"
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
          assignedStudent?.name ||
          assignedStudent?.email ||
          "Student",

        assignedBy:
          state.user.uid,

        assignedByName:
          state.profile.name ||
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
// ESCAPE HTML
// ============================================================

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

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


  // Navigation
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


  // Page target buttons
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


  // Logout
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


  // Add user
  $("addUserBtn")
    ?.addEventListener(
      "click",
      openUserModal
    );


  // Add task
  $("addTaskBtn")
    ?.addEventListener(
      "click",
      openTaskModal
    );


  // User form
  $("userForm")
    ?.addEventListener(
      "submit",
      createUser
    );


  // Task form
  $("taskForm")
    ?.addEventListener(
      "submit",
      createTask
    );


  // Modal close buttons
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


  // Modal backdrop
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

            modal?.classList
              .add(
                "hidden"
              );

          }
        );

      }
    );


  // Mobile menu
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
        action ===
        "accept"
      ) {

        await acceptTask(
          taskId
        );

      }

      if (
        action ===
        "start"
      ) {

        await startTask(
          taskId
        );

      }

      if (
        action ===
        "complete"
      ) {

        await completeTask(
          taskId
        );

      }

    }
  );


  // ----------------------------------------------------------
  // USER / STUDENT PROGRESS CLICK
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
            user.uid ===
            studentId
        );

      if (
        !student ||
        student.role !==
          "student"
      ) {

        return;

      }

      state.selectedStudentId =
        studentId;

      if (
        state.currentPage !==
        "progress"
      ) {

        showPage(
          "progress"
        );

      } else {

        renderProgress();

      }

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

      }

    } catch (error) {

      console.error(
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
