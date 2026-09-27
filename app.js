// ============================================================
// TASK MANAGER
// Main Application
// Version 1.0.0
// ============================================================

import {
  auth,
  db,
  app
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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
// APP STATE
// ============================================================

const state = {
  user: null,
  profile: null,
  users: [],
  tasks: [],
  currentPage: "dashboard"
};


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}


// ============================================================
// LOADER
// ============================================================

function hideLoader() {
  const loader = $("appLoader");

  if (loader) {
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";

    setTimeout(() => {
      loader.remove();
    }, 250);
  }
}


// ============================================================
// TOAST
// ============================================================

let toastTimer = null;

function toast(message, type = "success") {
  const box = $("toast");
  const text = $("toastMessage");
  const icon = $("toastIcon");

  if (!box || !text) return;

  text.textContent = message;

  if (icon) {
    icon.textContent =
      type === "error" ? "!" :
      type === "warning" ? "!" :
      "✓";

    icon.style.background =
      type === "error"
        ? "#dc2626"
        : type === "warning"
        ? "#f59e0b"
        : "#22c55e";
  }

  show("toast");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    hide("toast");
  }, 3500);
}


// ============================================================
// FORM MESSAGE
// ============================================================

function message(id, text, type = "error") {
  const el = $(id);

  if (!el) return;

  el.textContent = text;

  el.style.color =
    type === "success"
      ? "#15803d"
      : type === "warning"
      ? "#b45309"
      : "#dc2626";
}


// ============================================================
// ERROR TRANSLATION
// ============================================================

function firebaseError(error) {

  const code = error?.code || "";

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
      "You do not have permission for this action."
  };

  return errors[code] ||
    error?.message ||
    "Something went wrong. Please try again.";
}


// ============================================================
// INITIAL AUTH UI
// ============================================================

function showLogin() {
  show("loginPanel");
  hide("registerPanel");

  message("loginMessage", "");
  message("registerMessage", "");
}

function showRegister() {
  hide("loginPanel");
  show("registerPanel");

  message("loginMessage", "");
  message("registerMessage", "");
}


// ============================================================
// PASSWORD TOGGLE
// ============================================================

function setupPasswordToggles() {

  document
    .querySelectorAll(".password-toggle")
    .forEach(button => {

      button.addEventListener("click", () => {

        const target = $(button.dataset.target);

        if (!target) return;

        if (target.type === "password") {

          target.type = "text";

          button.textContent = "🙈";

          button.setAttribute(
            "aria-label",
            "Hide password"
          );

        } else {

          target.type = "password";

          button.textContent = "👁";

          button.setAttribute(
            "aria-label",
            "Show password"
          );
        }

      });

    });
}


// ============================================================
// REGISTER ADMIN
// ============================================================

async function registerAdmin(event) {

  event.preventDefault();

  const name =
    $("registerName")?.value.trim();

  const email =
    $("registerEmail")?.value.trim();

  const password =
    $("registerPassword")?.value;

  const confirmPassword =
    $("registerConfirmPassword")?.value;

  message("registerMessage", "");

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

  if (password.length < 6) {
    message(
      "registerMessage",
      "Password must contain at least 6 characters."
    );
    return;
  }

  if (password !== confirmPassword) {
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
    button.disabled = true;
    button.textContent = "Creating Account...";
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
        displayName: name
      }
    );

    await setDoc(
      doc(db, "users", firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        name,
        email,
        role: "admin",
        active: true,
        createdAt: serverTimestamp()
      }
    );

    await sendEmailVerification(
      firebaseUser
    );

    message(
      "registerMessage",
      "Account created. A verification email has been sent to your email address.",
      "success"
    );

    toast(
      "Admin account created successfully."
    );

    $("registerForm").reset();

    setTimeout(() => {
      showLogin();
    }, 1800);

  } catch (error) {

    console.error(error);

    message(
      "registerMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Create Account";
    }
  }
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(event) {

  event.preventDefault();

  const email =
    $("loginEmail")?.value.trim();

  const password =
    $("loginPassword")?.value;

  message("loginMessage", "");

  if (!email || !password) {

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
    button.disabled = true;
    button.textContent = "Signing In...";
  }

  try {

    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    const firebaseUser =
      credential.user;

    if (!firebaseUser.emailVerified) {

      await signOut(auth);

      message(
        "loginMessage",
        "Please verify your email first. Check your inbox.",
        "warning"
      );

      return;
    }

    toast("Login successful.");

  } catch (error) {

    console.error(error);

    message(
      "loginMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Sign In";
    }
  }
}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadProfile(firebaseUser) {

  const ref =
    doc(db, "users", firebaseUser.uid);

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {

    throw new Error(
      "Your account profile was not found in the database."
    );
  }

  const data = snap.data();

  state.user = firebaseUser;
  state.profile = {
    ...data,
    uid: firebaseUser.uid
  };

  return state.profile;
}


// ============================================================
// START APPLICATION
// ============================================================

async function startApplication(firebaseUser) {

  try {

    await loadProfile(firebaseUser);

    hide("authScreen");
    show("mainApp");

    updateUserInterface();

    await loadUsers();

    await loadTasks();

    updateDashboard();

    showPage("dashboard");

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );

    await signOut(auth);

    show("authScreen");
    hide("mainApp");
  }
}


// ============================================================
// USER INTERFACE
// ============================================================

function initials(name = "User") {

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "U";
}


function updateUserInterface() {

  const profile = state.profile;

  if (!profile) return;

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
    $("headerUserName").textContent = name;

  if ($("headerUserRole"))
    $("headerUserRole").textContent = role;

  if ($("sidebarName"))
    $("sidebarName").textContent = name;

  if ($("sidebarRole"))
    $("sidebarRole").textContent = role;

  if ($("sidebarAvatar"))
    $("sidebarAvatar").textContent = avatar;

  if ($("profileAvatar"))
    $("profileAvatar").textContent = avatar;

  if ($("profileName"))
    $("profileName").textContent = name;

  if ($("profileNameDetail"))
    $("profileNameDetail").textContent = name;

  if ($("profileEmail"))
    $("profileEmail").textContent =
      profile.email ||
      state.user?.email ||
      "—";

  if ($("profileRole"))
    $("profileRole").textContent = role;

  if ($("profileRoleDetail"))
    $("profileRoleDetail").textContent = role;

  if ($("profileStatus"))
    $("profileStatus").textContent =
      profile.active === false
        ? "Inactive"
        : "Active";


  const isAdmin =
    role === "admin" ||
    role === "superadmin";

  const isSuperAdmin =
    role === "superadmin";


  document
    .querySelectorAll(".admin-only")
    .forEach(el => {

      if (isAdmin) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
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


  if (!isSuperAdmin) {

    // Normal admins only see their own users/tasks.
    // Students see only their own tasks.
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

  pages.forEach(name => {

    const pageElement =
      $(`${name}Page`);

    if (!pageElement) return;

    if (name === page) {
      pageElement.classList.remove("hidden");
      pageElement.classList.add("active-page");
    } else {
      pageElement.classList.add("hidden");
      pageElement.classList.remove("active-page");
    }
  });


  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });


  state.currentPage = page;

  closeMobileSidebar();


  if (page === "dashboard") {
    updateDashboard();
  }

  if (page === "users") {
    renderUsers();
  }

  if (page === "tasks") {
    renderTasks();
  }

  if (page === "progress") {
    renderProgress();
  }
}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {

  if (!state.profile) return;

  const role = state.profile.role;

  try {

    let q;

    if (role === "superadmin") {

      q = query(
        collection(db, "users"),
        where("role", "==", "student")
      );

    } else if (role === "admin") {

      q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where(
          "createdBy",
          "==",
          state.user.uid
        )
      );

    } else {

      state.users = [];
      return;
    }

    const snap = await getDocs(q);

    state.users =
      snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

  } catch (error) {

    console.error("Users error:", error);

    state.users = [];
  }
}


// ============================================================
// LOAD TASKS
// ============================================================

async function loadTasks() {

  if (!state.profile) return;

  const role =
    state.profile.role;

  try {

    let q;

    if (role === "superadmin") {

      q = query(
        collection(db, "tasks"),
        orderBy("assignedAt", "desc")
      );

    } else if (role === "admin") {

      q = query(
        collection(db, "tasks"),
        where(
          "assignedBy",
          "==",
          state.user.uid
        )
      );

    } else {

      q = query(
        collection(db, "tasks"),
        where(
          "assignedTo",
          "==",
          state.user.uid
        )
      );
    }

    const snap = await getDocs(q);

    state.tasks =
      snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

    state.tasks.sort(
      (a, b) =>
        timestampValue(b.assignedAt) -
        timestampValue(a.assignedAt)
    );

  } catch (error) {

    console.error("Tasks error:", error);

    state.tasks = [];
  }
}


// ============================================================
// TIMESTAMP HELPERS
// ============================================================

function timestampValue(timestamp) {

  if (!timestamp) return 0;

  if (
    typeof timestamp.toMillis === "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    timestamp.seconds !== undefined
  ) {
    return timestamp.seconds * 1000;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  return 0;
}


function formatDate(timestamp) {

  const value =
    timestampValue(timestamp);

  if (!value) return "—";

  return new Date(value)
    .toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );
}


function formatDuration(ms) {

  if (!ms || ms < 0) {
    return "—";
  }

  const totalSeconds =
    Math.floor(ms / 1000);

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {

    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {

    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}


// ============================================================
// STATUS HELPERS
// ============================================================

function statusLabel(status) {

  const labels = {

    pending: "Pending",

    accepted: "Accepted",

    in_progress: "In Progress",

    completed: "Completed"
  };

  return labels[status] || "Pending";
}


function statusClass(status) {

  return `status-${status || "pending"}`;
}


// ============================================================
// USER NAME
// ============================================================

function getUserName(uid) {

  const user =
    state.users.find(
      item => item.uid === uid ||
              item.id === uid
    );

  return user?.name ||
    user?.email ||
    "User";
}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {

  const tasks =
    state.tasks || [];

  const total =
    tasks.length;

  const pending =
    tasks.filter(
      t => (t.status || "pending") === "pending"
    ).length;

  const inProgress =
    tasks.filter(
      t => t.status === "in_progress"
    ).length;

  const completed =
    tasks.filter(
      t => t.status === "completed"
    ).length;


  if ($("statTotalTasks"))
    $("statTotalTasks").textContent = total;

  if ($("statPending"))
    $("statPending").textContent = pending;

  if ($("statInProgress"))
    $("statInProgress").textContent =
      inProgress;

  if ($("statCompleted"))
    $("statCompleted").textContent =
      completed;


  const percentage =
    total === 0
      ? 0
      : Math.round(
          (completed / total) * 100
        );


  if ($("overviewPercentage"))
    $("overviewPercentage").textContent =
      `${percentage}%`;


  if ($("overviewProgress")) {

    $("overviewProgress").style.background =
      `conic-gradient(
        #4f46e5 ${percentage * 3.6}deg,
        #edf0f7 ${percentage * 3.6}deg
      )`;
  }


  renderRecentTasks();
}


// ============================================================
// RENDER RECENT TASKS
// ============================================================

function renderRecentTasks() {

  const container =
    $("recentTasksContainer");

  if (!container) return;

  const tasks =
    state.tasks.slice(0, 6);

  if (!tasks.length) {

    container.innerHTML = emptyHTML(
      "✓",
      "No tasks yet",
      "Tasks will appear here."
    );

    return;
  }

  container.innerHTML =
    tasks.map(taskHTML).join("");
}


// ============================================================
// TASK HTML
// ============================================================

function taskHTML(task) {

  const status =
    task.status || "pending";

  const assignedTo =
    getUserName(task.assignedTo);

  const duration =
    task.durationMs
      ? formatDuration(task.durationMs)
      : "Not completed";

  return `
    <div class="task-item">

      <div class="task-main">

        <div class="task-title">
          ${escapeHTML(task.title || "Untitled Task")}
        </div>

        <div class="task-description">
          ${escapeHTML(
            task.description || "No description"
          )}
        </div>

        <div class="task-meta">

          <span>
            ${escapeHTML(assignedTo)}
          </span>

          <span>•</span>

          <span>
            Assigned ${escapeHTML(
              formatDate(task.assignedAt)
            )}
          </span>

          ${
            task.completedAt
              ? `
                <span>•</span>
                <span>
                  Duration:
                  ${escapeHTML(duration)}
                </span>
              `
              : ""
          }

        </div>

      </div>


      <div class="task-actions">

        <span
          class="status-badge ${statusClass(status)}"
        >
          ${statusLabel(status)}
        </span>

        ${taskActionButtons(task)}

      </div>

    </div>
  `;
}


// ============================================================
// TASK ACTION BUTTONS
// ============================================================

function taskActionButtons(task) {

  const role =
    state.profile?.role;

  const status =
    task.status || "pending";


  if (role === "student") {

    if (status === "pending") {

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

    if (status === "accepted") {

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

    if (status === "in_progress") {

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
  }


  return "";
}


// ============================================================
// ACCEPT TASK
// ============================================================

async function acceptTask(taskId) {

  const task =
    state.tasks.find(
      item => item.id === taskId
    );

  if (!task) return;

  try {

    await updateDoc(
      doc(db, "tasks", taskId),
      {
        status: "accepted",
        acceptedAt: serverTimestamp()
      }
    );

    toast("Task accepted.");

    await loadTasks();

    updateDashboard();

    if (state.currentPage === "tasks") {
      renderTasks();
    }

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


// ============================================================
// START TASK
// ============================================================

async function startTask(taskId) {

  const task =
    state.tasks.find(
      item => item.id === taskId
    );

  if (!task) return;

  try {

    await updateDoc(
      doc(db, "tasks", taskId),
      {
        status: "in_progress",
        startedAt: serverTimestamp()
      }
    );

    toast("Task started.");

    await loadTasks();

    updateDashboard();

    if (state.currentPage === "tasks") {
      renderTasks();
    }

  } catch (error) {

    console.error(error);

    toast(
      firebaseError(error),
      "error"
    );
  }
}


// ============================================================
// COMPLETE TASK
// ============================================================

async function completeTask(taskId) {

  const task =
    state.tasks.find(
      item => item.id === taskId
    );

  if (!task) return;

  try {

    const completedAt =
      Date.now();

    const startedAt =
      timestampValue(task.startedAt);

    const durationMs =
      startedAt
        ? Math.max(
            0,
            completedAt - startedAt
          )
        : 0;


    await updateDoc(
      doc(db, "tasks", taskId),
      {
        status: "completed",

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

    if (state.currentPage === "tasks") {
      renderTasks();
    }

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
    $("allTasksContainer");

  if (!container) return;

  const search =
    $("taskSearch")?.value
      .trim()
      .toLowerCase() || "";

  const filter =
    $("taskStatusFilter")?.value ||
    "all";


  let tasks =
    [...state.tasks];


  if (search) {

    tasks =
      tasks.filter(task => {

        const text =
          `${task.title || ""} ${
            task.description || ""
          }`.toLowerCase();

        return text.includes(search);
      });
  }


  if (filter !== "all") {

    tasks =
      tasks.filter(
        task =>
          (task.status || "pending") === filter
      );
  }


  if (!tasks.length) {

    container.innerHTML = emptyHTML(
      "✓",
      "No tasks found",
      "There are no tasks matching your search."
    );

    return;
  }


  container.innerHTML =
    tasks.map(taskHTML).join("");
}


// ============================================================
// RENDER USERS
// ============================================================

function renderUsers() {

  const container =
    $("usersContainer");

  if (!container) return;


  if (!state.users.length) {

    container.innerHTML = `
      <div class="empty-state full-width">

        <div class="empty-icon">
          👥
        </div>

        <h4>No users found</h4>

        <p>
          Create your first user to assign tasks.
        </p>

      </div>
    `;

    return;
  }


  container.innerHTML =
    state.users
      .map(user => {

        const userTasks =
          state.tasks.filter(
            task =>
              task.assignedTo === user.uid
          );

        const total =
          userTasks.length;

        const completed =
          userTasks.filter(
            task =>
              task.status === "completed"
          ).length;

        const progress =
          total
            ? Math.round(
                (completed / total) * 100
              )
            : 0;


        return `
          <div class="user-card">

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


            <div class="user-card-footer">

              <span class="status-badge status-completed">
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
                User Account
              </span>

            </div>

          </div>
        `;

      })
      .join("");
}


// ============================================================
// RENDER PROGRESS
// ============================================================

function renderProgress() {

  const container =
    $("progressSummary");

  if (!container) return;


  if (!state.users.length) {

    container.innerHTML = emptyHTML(
      "▥",
      "No progress data",
      "Create users and assign tasks to see progress."
    );

    return;
  }


  container.innerHTML =
    state.users
      .map(user => {

        const tasks =
          state.tasks.filter(
            task =>
              task.assignedTo === user.uid
          );

        const total =
          tasks.length;

        const completed =
          tasks.filter(
            task =>
              task.status === "completed"
          ).length;

        const accepted =
          tasks.filter(
            task =>
              task.status === "accepted"
          ).length;

        const inProgress =
          tasks.filter(
            task =>
              task.status === "in_progress"
          ).length;

        const percentage =
          total
            ? Math.round(
                (completed / total) * 100
              )
            : 0;


        return `
          <div class="progress-user">

            <div class="progress-user-header">

              <span class="progress-user-name">
                ${escapeHTML(
                  user.name ||
                  user.email ||
                  "User"
                )}
              </span>

              <span class="progress-percentage">
                ${percentage}%
              </span>

            </div>


            <div class="progress-bar">

              <div
                class="progress-bar-fill"
                style="width:${percentage}%"
              ></div>

            </div>


            <div class="progress-user-meta">

              <span>
                ${completed} completed
              </span>

              <span>
                ${inProgress} in progress
              </span>

              <span>
                ${accepted} accepted
              </span>

              <span>
                ${total} total
              </span>

            </div>

          </div>
        `;

      })
      .join("");
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
        ${escapeHTML(description)}
      </p>

    </div>
  `;
}


// ============================================================
// ADD USER MODAL
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

  show("userModal");

  message("userMessage", "");

  $("userForm")?.reset();
}


function closeUserModal() {
  hide("userModal");
}


// ============================================================
// ADD TASK MODAL
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

  show("taskModal");

  message("taskMessage", "");

  $("taskForm")?.reset();

  populateTaskUsers();
}


function closeTaskModal() {
  hide("taskModal");
}


function populateTaskUsers() {

  const select =
    $("taskUser");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a user
    </option>
  `;


  state.users.forEach(user => {

    const option =
      document.createElement("option");

    option.value =
      user.uid || user.id;

    option.textContent =
      `${user.name || "User"} — ${
        user.email || ""
      }`;

    select.appendChild(option);
  });
}


// ============================================================
// CREATE USER
// ============================================================

async function createUser(event) {

  event.preventDefault();

  /*
    IMPORTANT:
    Creating another Firebase Authentication user
    must be done through a secure backend / Cloud Function.

    This frontend does NOT create users directly because
    doing so would log the admin out of their own account.

    The actual createStudent Cloud Function will be
    connected in the backend setup step.
  */

  message(
    "userMessage",
    "Secure user creation will be connected through the Firebase Cloud Function.",
    "warning"
  );

  toast(
    "Secure user creation backend is not deployed yet.",
    "warning"
  );
}


// ============================================================
// CREATE TASK
// ============================================================

async function createTask(event) {

  event.preventDefault();

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {
    return;
  }


  const title =
    $("taskTitle")?.value.trim();

  const description =
    $("taskDescription")?.value.trim();

  const assignedTo =
    $("taskUser")?.value;

  const dueDate =
    $("taskDueDate")?.value || null;


  message("taskMessage", "");


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

    button.disabled = true;
    button.textContent = "Assigning...";
  }


  try {

    await addDoc(
      collection(db, "tasks"),
      {

        title,

        description,

        assignedTo,

        assignedBy:
          state.user.uid,

        assignedByName:
          state.profile.name ||
          state.user.displayName ||
          "Admin",

        status: "pending",

        dueDate,

        assignedAt:
          serverTimestamp(),

        acceptedAt: null,

        startedAt: null,

        completedAt: null,

        durationMs: 0
      }
    );


    toast(
      "Task assigned successfully."
    );

    closeTaskModal();

    await loadTasks();

    updateDashboard();

    renderTasks();

  } catch (error) {

    console.error(error);

    message(
      "taskMessage",
      firebaseError(error)
    );

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "Assign Task";
    }
  }
}


// ============================================================
// SEARCH / FILTER
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
    ?.classList.add("open");

  $("sidebarOverlay")
    ?.classList.remove("hidden");
}


function closeMobileSidebar() {

  $("sidebar")
    ?.classList.remove("open");

  $("sidebarOverlay")
    ?.classList.add("hidden");
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEvents() {

  // Login
  $("loginForm")
    ?.addEventListener(
      "submit",
      loginUser
    );


  // Register
  $("registerForm")
    ?.addEventListener(
      "submit",
      registerAdmin
    );


  // Login/Register switch
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


  // Password toggles
  setupPasswordToggles();


  // Navigation
  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.addEventListener(
        "click",
        () => {

          const page =
            item.dataset.page;

          if (page) {
            showPage(page);
          }

        }
      );

    });


  // Dashboard view all
  document
    .querySelectorAll("[data-page-target]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.pageTarget
          );

        }
      );

    });


  // Logout
  $("logoutBtn")
    ?.addEventListener(
      "click",
      async () => {

        try {

          await signOut(auth);

          toast("Logged out successfully.");

        } catch (error) {

          console.error(error);

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


  // Forms
  $("userForm")
    ?.addEventListener(
      "submit",
      createUser
    );


  $("taskForm")
    ?.addEventListener(
      "submit",
      createTask
    );


  // Modal close buttons
  document
    .querySelectorAll("[data-close-modal]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const modalId =
            button.dataset.closeModal;

          hide(modalId);

        }
      );

    });


  // Click modal backdrop to close
  document
    .querySelectorAll(".modal-backdrop")
    .forEach(backdrop => {

      backdrop.addEventListener(
        "click",
        () => {

          const modal =
            backdrop.closest(".modal");

          modal?.classList.add("hidden");

        }
      );

    });


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


  // Task filters
  setupTaskFilters();


  // Task action delegation
  document.addEventListener(
    "click",
    async event => {

      const button =
        event.target.closest(
          "[data-task-action]"
        );

      if (!button) return;

      const action =
        button.dataset.taskAction;

      const taskId =
        button.dataset.taskId;

      if (!taskId) return;


      if (action === "accept") {
        await acceptTask(taskId);
      }

      if (action === "start") {
        await startTask(taskId);
      }

      if (action === "complete") {
        await completeTask(taskId);
      }

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

        show("authScreen");
        hide("mainApp");

      }

    } catch (error) {

      console.error(error);

      show("authScreen");
      hide("mainApp");

    } finally {

      hideLoader();

    }

  }
);


// ============================================================
// INITIALIZE
// ============================================================

setupEvents();
