// ============================================================
// TASK MANAGER
// Version 1.0.7
// Complete Application Logic
// Improved Firebase/Auth Startup Diagnostics
// ============================================================

import { app, auth, db } from "./firebase.js";

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
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
  initializeApp as initializeSecondaryApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth as getSecondaryAuth,
  createUserWithEmailAndPassword as createSecondaryUser,
  updateProfile as updateSecondaryProfile,
  signOut as signOutSecondary
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const VERSION = "v1.0.7";

const state = {
  user: null,
  profile: null,
  users: [],
  tasks: [],
  selectedStudentId: null,
  currentPage: "dashboard",
  loading: false,
  startupFinished: false
};

const $ = id => document.getElementById(id);

// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firebaseError(error) {
  console.error(error);

  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/invalid-credential":
      "Invalid email or password.",

    "auth/user-not-found":
      "No account was found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-api-key":
      "Firebase API key is invalid. Please check firebase.js.",

    "auth/api-key-not-valid":
      "Firebase API key is not valid. Please check firebase.js.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "auth/operation-not-allowed":
      "Email/password authentication is not enabled in Firebase.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/user-disabled":
      "This account has been disabled.",

    "permission-denied":
      "Firestore permission denied. Please check Firestore Rules.",

    "failed-precondition":
      "Firestore needs an index or configuration is incomplete.",

    "unavailable":
      "Firebase is temporarily unavailable.",

    "not-found":
      "The requested Firebase resource was not found."
  };

  if (messages[code]) {
    return messages[code];
  }

  if (error?.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function setMessage(id, message, type = "") {
  const element = $(id);

  if (!element) return;

  element.textContent = message;
  element.className = "";

  if (type) {
    element.classList.add(type);
  }
}

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  const icon = $("toastIcon");
  const text = $("toastMessage");

  if (text) {
    text.textContent = message;
  }

  if (icon) {
    icon.textContent =
      type === "error"
        ? "✕"
        : type === "warning"
        ? "!"
        : "✓";
  }

  toast.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

// ============================================================
// STARTUP ERROR SCREEN
// ============================================================

function showStartupError(error, where = "Application startup") {
  console.error(where, error);

  const message = firebaseError(error);

  const authScreen = $("authScreen");
  const mainApp = $("mainApp");

  if (authScreen) {
    authScreen.style.display = "";
  }

  if (mainApp) {
    mainApp.style.display = "none";
  }

  if ($("loginPanel")) {
    $("loginPanel").style.display = "";
  }

  if ($("registerPanel")) {
    $("registerPanel").style.display = "none";
  }

  let box = $("startupErrorBox");

  if (!box && authScreen) {
    box = document.createElement("div");

    box.id = "startupErrorBox";

    box.style.cssText =
      "margin:16px auto;" +
      "max-width:520px;" +
      "padding:18px;" +
      "border-radius:14px;" +
      "background:#fff0f0;" +
      "color:#9b0000;" +
      "border:1px solid #ffbcbc;" +
      "font-family:inherit;" +
      "line-height:1.55;" +
      "white-space:pre-wrap;" +
      "box-sizing:border-box;";

    authScreen.appendChild(box);
  }

  if (box) {
    box.innerHTML =
      "<strong>Task Manager could not finish loading.</strong>" +
      "<br><br>" +
      escapeHTML(message) +
      "<br><br>" +
      "<strong>Location:</strong> " +
      escapeHTML(where) +
      "<br>" +
      "<strong>Version:</strong> " +
      escapeHTML(VERSION) +
      "<br><br>" +
      "<small>Please use the message above to identify the Firebase problem.</small>";
  }
}

function clearStartupError() {
  const box = $("startupErrorBox");

  if (box) {
    box.remove();
  }
}

// ============================================================
// STARTUP TIMEOUT
// ============================================================

let startupTimer = null;

function startStartupTimer() {
  clearTimeout(startupTimer);

  startupTimer = setTimeout(() => {
    if (
      !state.startupFinished &&
      !state.user
    ) {
      showStartupError(
        new Error(
          "Firebase Authentication did not finish initializing. Check Firebase Authentication, firebase.js configuration, and the deployed website."
        ),
        "Firebase Authentication timeout"
      );
    }
  }, 12000);
}

function stopStartupTimer() {
  clearTimeout(startupTimer);
  startupTimer = null;
}

// ============================================================
// DATE HELPERS
// ============================================================

function formatDate(value) {
  if (!value) return "—";

  try {
    const date =
      value?.toDate
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
}

function formatDateTime(value) {
  if (!value) return "—";

  try {
    const date =
      value?.toDate
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function getTaskDate(task) {
  return task?.assignedAt || task?.createdAt || null;
}

function getStatusText(status) {
  return (
    {
      pending: "Pending",
      accepted: "Accepted",
      in_progress: "In Progress",
      completed: "Completed"
    }[status] || "Pending"
  );
}

function getStatusClass(status) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in-progress";
  if (status === "accepted") return "accepted";

  return "pending";
}

// ============================================================
// MODALS / NAVIGATION
// ============================================================

function openModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.add("show");
  modal.style.display = "flex";
}

function closeModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("show");
  modal.style.display = "";
}

function closeSidebarMobile() {
  document.body.classList.remove("sidebar-open");

  document
    .querySelector(".sidebar")
    ?.classList.remove("open");
}

function showLoginPanel() {
  if ($("loginPanel")) {
    $("loginPanel").style.display = "";
  }

  if ($("registerPanel")) {
    $("registerPanel").style.display = "none";
  }
}

function showRegisterPanel() {
  if ($("loginPanel")) {
    $("loginPanel").style.display = "none";
  }

  if ($("registerPanel")) {
    $("registerPanel").style.display = "";
  }
}

function showPage(page) {
  state.currentPage = page;

  [
    "dashboardPage",
    "usersPage",
    "tasksPage",
    "progressPage",
    "profilePage"
  ].forEach(id => {
    const element = $(id);

    if (!element) return;

    const active = id === `${page}Page`;

    element.style.display = active ? "" : "none";

    element.classList.toggle("active", active);
  });

  document
    .querySelectorAll("[data-page]")
    .forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.page === page
      );
    });

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

  if (page === "profile") {
    renderProfile();
  }

  closeSidebarMobile();
}

// ============================================================
// AUTH
// ============================================================

async function loginUser(event) {
  event.preventDefault();

  const email =
    $("loginEmail")?.value.trim();

  const password =
    $("loginPassword")?.value;

  if (!email || !password) {
    setMessage(
      "loginMessage",
      "Please enter email and password.",
      "error"
    );

    return;
  }

  setMessage(
    "loginMessage",
    "Signing in..."
  );

  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    setMessage(
      "loginMessage",
      ""
    );

    showToast(
      "Login successful."
    );

  } catch (error) {
    setMessage(
      "loginMessage",
      firebaseError(error),
      "error"
    );
  }
}

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

  if (
    !name ||
    !email ||
    !password ||
    !confirmPassword
  ) {
    setMessage(
      "registerMessage",
      "Please fill in all fields.",
      "error"
    );

    return;
  }

  if (password !== confirmPassword) {
    setMessage(
      "registerMessage",
      "Passwords do not match.",
      "error"
    );

    return;
  }

  if (password.length < 6) {
    setMessage(
      "registerMessage",
      "Password must be at least 6 characters.",
      "error"
    );

    return;
  }

  setMessage(
    "registerMessage",
    "Creating account..."
  );

  try {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const newUser =
      credential.user;

    await updateProfile(
      newUser,
      {
        displayName: name
      }
    );

    await setDoc(
      doc(
        db,
        "users",
        newUser.uid
      ),
      {
        uid: newUser.uid,
        name,
        email,
        role: "admin",
        active: true,
        createdAt:
          serverTimestamp()
      }
    );

    setMessage(
      "registerMessage",
      "Admin account created successfully."
    );

    showToast(
      "Admin account created."
    );

    $("registerForm")?.reset();

    setTimeout(() => {
      showLoginPanel();
    }, 800);

  } catch (error) {
    setMessage(
      "registerMessage",
      firebaseError(error),
      "error"
    );
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    showToast(
      firebaseError(error),
      "error"
    );
  }
}

// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {
  if (!state.user) {
    throw new Error(
      "No signed-in Firebase user was found."
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        state.user.uid
      )
    );

  if (!snapshot.exists()) {

    state.profile = {
      uid: state.user.uid,

      name:
        state.user.displayName ||
        "User",

      email:
        state.user.email ||
        "",

      role:
        "student",

      active:
        true
    };

  } else {

    state.profile = {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  updateUserUI();
  updateAvatar();
}

function updateUserUI() {
  const profile =
    state.profile || {};

  const authUser =
    state.user || {};

  const name =
    profile.name ||
    authUser.displayName ||
    authUser.email ||
    "User";

  const email =
    profile.email ||
    authUser.email ||
    "";

  const role =
    profile.role ||
    "student";

  const roleText =
    role.charAt(0).toUpperCase() +
    role.slice(1);

  document
    .querySelectorAll(
      "[data-user-name]"
    )
    .forEach(el => {
      el.textContent = name;
    });

  document
    .querySelectorAll(
      "[data-user-email]"
    )
    .forEach(el => {
      el.textContent = email;
    });

  document
    .querySelectorAll(
      "[data-user-role]"
    )
    .forEach(el => {
      el.textContent = roleText;
    });

  [
    "headerUserName",
    "sidebarName",
    "profileName",
    "profileNameDetail"
  ].forEach(id => {

    if ($(id)) {
      $(id).textContent = name;
    }

  });

  [
    "headerUserRole",
    "sidebarRole",
    "profileRole",
    "profileRoleDetail"
  ].forEach(id => {

    if ($(id)) {
      $(id).textContent =
        roleText;
    }

  });

  if ($("profileEmail")) {
    $("profileEmail").textContent =
      email;
  }

  if ($("profileStatus")) {
    $("profileStatus").textContent =
      profile.active === false
        ? "Inactive"
        : "Active";
  }

  document
    .querySelectorAll(
      "#appVersion,[data-app-version]"
    )
    .forEach(el => {
      el.textContent =
        `Task Manager ${VERSION}`;
    });
}

function renderProfile() {
  updateUserUI();
  updateAvatar();
}

function updateAvatar() {
  const name =
    state.profile?.name ||
    state.user?.displayName ||
    state.user?.email ||
    "U";

  const letter =
    name.charAt(0).toUpperCase();

  [
    "sidebarAvatar",
    "profileAvatar"
  ].forEach(id => {

    if ($(id)) {
      $(id).textContent =
        letter;
    }

  });
}

// ============================================================
// USERS
// ============================================================

async function loadUsers() {
  if (!state.profile) return;

  try {

    if (
      state.profile.role === "admin" ||
      state.profile.role === "superadmin"
    ) {

      const snapshot =
        await getDocs(
          query(
            collection(db, "users"),
            where(
              "role",
              "==",
              "student"
            )
          )
        );

      state.users =
        snapshot.docs.map(
          docItem => ({
            id: docItem.id,
            ...docItem.data()
          })
        );

    } else {

      const snapshot =
        await getDoc(
          doc(
            db,
            "users",
            state.user.uid
          )
        );

      state.users =
        snapshot.exists()
          ? [
              {
                id: snapshot.id,
                ...snapshot.data()
              }
            ]
          : [];
    }

    renderUsers();
    populateTaskUsers();

  } catch (error) {

    showStartupError(
      error,
      "Loading users"
    );

    throw error;
  }
}

function renderUsers() {
  const container =
    $("usersContainer") ||
    $("usersList");

  if (!container) return;

  if (
    !["admin", "superadmin"]
      .includes(
        state.profile?.role
      )
  ) {

    container.innerHTML =
      `<div class="empty-state">
        <p>User management is available to administrators.</p>
      </div>`;

    return;
  }

  if (!state.users.length) {

    container.innerHTML =
      `<div class="empty-state">
        <p>No students found.</p>
      </div>`;

    return;
  }

  container.innerHTML =
    state.users
      .map(user => {

        const id =
          user.uid ||
          user.id;

        const userTasks =
          state.tasks.filter(
            task =>
              task.assignedTo ===
              id
          );

        const completed =
          userTasks.filter(
            task =>
              task.status ===
              "completed"
          ).length;

        const total =
          userTasks.length;

        const percentage =
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
            data-student-id="${escapeHTML(id)}"
          >

            <div class="user-card-main">

              <div class="user-avatar">
                ${escapeHTML(
                  (user.name || "S")
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <div class="user-info">

                <h3>
                  ${escapeHTML(
                    user.name ||
                    "Student"
                  )}
                </h3>

                <p>
                  ${escapeHTML(
                    user.email ||
                    ""
                  )}
                </p>

                <span class="user-role">
                  Student
                </span>

              </div>

            </div>

            <div class="user-progress">

              <div class="progress-top">

                <span>
                  Progress
                </span>

                <strong>
                  ${percentage}%
                </strong>

              </div>

              <div class="progress-bar">

                <div
                  class="progress-fill"
                  style="width:${percentage}%"
                ></div>

              </div>

              <small>
                ${completed}
                of
                ${total}
                tasks completed
              </small>

            </div>

            <div class="user-meta">

              <small>
                Created by:
                ${escapeHTML(
                  user.createdByName ||
                  "—"
                )}
              </small>

            </div>

          </div>
        `;
      })
      .join("");

  container
    .querySelectorAll(
      "[data-student-id]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          state.selectedStudentId =
            card.dataset.studentId;

          showPage(
            "progress"
          );
        }
      );

    });
}

async function createUser(event) {
  event.preventDefault();

  if (
    !["admin", "superadmin"]
      .includes(
        state.profile?.role
      )
  ) {

    setMessage(
      "userMessage",
      "You do not have permission.",
      "error"
    );

    return;
  }

  const name =
    $("userName")?.value.trim();

  const email =
    $("userEmail")?.value.trim();

  const password =
    $("userPassword")?.value;

  if (
    !name ||
    !email ||
    !password
  ) {

    setMessage(
      "userMessage",
      "Please fill in all fields.",
      "error"
    );

    return;
  }

  if (password.length < 6) {

    setMessage(
      "userMessage",
      "Temporary password must be at least 6 characters.",
      "error"
    );

    return;
  }

  setMessage(
    "userMessage",
    "Creating student account..."
  );

  let secondaryApp = null;
  let secondaryAuth = null;

  try {

    const existing =
      await getDocs(
        query(
          collection(db, "users"),
          where(
            "email",
            "==",
            email
          )
        )
      );

    if (!existing.empty) {

      setMessage(
        "userMessage",
        "A user with this email already exists.",
        "error"
      );

      return;
    }

    secondaryApp =
      initializeSecondaryApp(
        app.options,
        `SecondaryApp-${Date.now()}`
      );

    secondaryAuth =
      getSecondaryAuth(
        secondaryApp
      );

    const credential =
      await createSecondaryUser(
        secondaryAuth,
        email,
        password
      );

    const student =
      credential.user;

    await updateSecondaryProfile(
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

    try {
      await signOutSecondary(
        secondaryAuth
      );
    } catch {}

    await deleteApp(
      secondaryApp
    );

    secondaryApp = null;

    await loadUsers();

    closeModal(
      "userModal"
    );

    $("userForm")?.reset();

    setMessage(
      "userMessage",
      ""
    );

    showToast(
      "Student account created successfully."
    );

  } catch (error) {

    if (secondaryApp) {

      try {
        await deleteApp(
          secondaryApp
        );
      } catch {}
    }

    setMessage(
      "userMessage",
      firebaseError(error),
      "error"
    );
  }
}

// ============================================================
// TASKS
// ============================================================

async function loadTasks() {
  if (!state.profile) return;

  try {

    if (
      state.profile.role === "admin" ||
      state.profile.role === "superadmin"
    ) {

      try {

        const snapshot =
          await getDocs(
            query(
              collection(db, "tasks"),
              orderBy(
                "assignedAt",
                "desc"
              )
            )
          );

        state.tasks =
          snapshot.docs.map(
            docItem => ({
              id: docItem.id,
              ...docItem.data()
            })
          );

      } catch {

        const snapshot =
          await getDocs(
            collection(db, "tasks")
          );

        state.tasks =
          snapshot.docs.map(
            docItem => ({
              id: docItem.id,
              ...docItem.data()
            })
          );

        state.tasks.sort(
          (a, b) =>
            (
              b.assignedAt
                ?.toMillis?.() ||
              0
            ) -
            (
              a.assignedAt
                ?.toMillis?.() ||
              0
            )
        );
      }

    } else {

      const snapshot =
        await getDocs(
          query(
            collection(db, "tasks"),
            where(
              "assignedTo",
              "==",
              state.user.uid
            )
          )
        );

      state.tasks =
        snapshot.docs.map(
          docItem => ({
            id: docItem.id,
            ...docItem.data()
          })
        );

      state.tasks.sort(
        (a, b) =>
          (
            b.assignedAt
              ?.toMillis?.() ||
            0
          ) -
          (
            a.assignedAt
              ?.toMillis?.() ||
            0
          )
      );
    }

    updateDashboard();
    renderTasks();
    renderRecentTasks();
    renderProgress();
    renderUsers();

  } catch (error) {

    showStartupError(
      error,
      "Loading tasks"
    );

    throw error;
  }
}

function populateTaskUsers() {
  const select =
    $("taskUser");

  if (!select) return;

  const oldValue =
    select.value;

  select.innerHTML =
    `<option value="">
      Select student
    </option>`;

  state.users.forEach(
    user => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        user.uid ||
        user.id;

      option.textContent =
        user.name ||
        user.email ||
        "Student";

      select.appendChild(
        option
      );
    }
  );

  if (oldValue) {
    select.value =
      oldValue;
  }
}

async function createTask(event) {
  event.preventDefault();

  if (
    !["admin", "superadmin"]
      .includes(
        state.profile?.role
      )
  ) {

    setMessage(
      "taskMessage",
      "You do not have permission.",
      "error"
    );

    return;
  }

  const title =
    $("taskTitle")?.value.trim();

  const description =
    $("taskDescription")?.value.trim();

  const assignedTo =
    $("taskUser")?.value;

  const dueDate =
    $("taskDueDate")?.value ||
    null;

  if (
    !title ||
    !assignedTo
  ) {

    setMessage(
      "taskMessage",
      "Please enter a title and select a student.",
      "error"
    );

    return;
  }

  const student =
    state.users.find(
      user =>
        (
          user.uid ||
          user.id
        ) ===
        assignedTo
    );

  if (!student) {

    setMessage(
      "taskMessage",
      "Selected student was not found.",
      "error"
    );

    return;
  }

  setMessage(
    "taskMessage",
    "Creating task..."
  );

  try {

    const adminName =
      state.profile?.name ||
      state.user?.displayName ||
      "Admin";

    await addDoc(
      collection(db, "tasks"),
      {
        title,

        description:
          description || "",

        assignedTo,

        assignedToName:
          student.name ||
          student.email ||
          "Student",

        assignedBy:
          state.user.uid,

        assignedByName:
          adminName,

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

    closeModal(
      "taskModal"
    );

    $("taskForm")?.reset();

    setMessage(
      "taskMessage",
      ""
    );

    await loadTasks();

    showToast(
      "Task assigned successfully."
    );

  } catch (error) {

    setMessage(
      "taskMessage",
      firebaseError(error),
      "error"
    );
  }
}

// ============================================================
// TASK CARD
// ============================================================

function taskCardHTML(task) {
  const role =
    state.profile?.role;

  const isStudent =
    role === "student";

  const canManage =
    role === "admin" ||
    role === "superadmin";

  const status =
    task.status ||
    "pending";

  const assignedBy =
    task.assignedByName ||
    "Admin";

  const studentName =
    task.assignedToName ||
    "Student";

  const due =
    task.dueDate
      ? formatDate(task.dueDate)
      : "No due date";

  const buttons = [];

  if (isStudent) {

    if (status === "pending") {

      buttons.push(`
        <button
          class="task-action-btn"
          data-task-action="accept"
          data-task-id="${escapeHTML(task.id)}"
        >
          Accept
        </button>
      `);

    }

    if (status === "accepted") {

      buttons.push(`
        <button
          class="task-action-btn"
          data-task-action="start"
          data-task-id="${escapeHTML(task.id)}"
        >
          Start Task
        </button>
      `);

    }

    if (status === "in_progress") {

      buttons.push(`
        <button
          class="task-action-btn"
          data-task-action="complete"
          data-task-id="${escapeHTML(task.id)}"
        >
          Complete
        </button>
      `);

    }
  }

  if (canManage) {

    buttons.push(`
      <button
        class="task-action-btn danger"
        data-task-action="delete"
        data-task-id="${escapeHTML(task.id)}"
      >
        Delete
      </button>
    `);

  }

  return `
    <div
      class="task-card"
      data-task-id="${escapeHTML(task.id)}"
    >

      <div class="task-card-header">

        <div>

          <h3>
            ${escapeHTML(
              task.title ||
              "Untitled Task"
            )}
          </h3>

          <span
            class="task-status ${getStatusClass(status)}"
          >
            ${getStatusText(status)}
          </span>

        </div>

      </div>

      ${
        task.description
          ? `
            <p class="task-description">
              ${escapeHTML(
                task.description
              )}
            </p>
          `
          : ""
      }

      <div class="task-details">

        ${
          isStudent
            ? `
              <div>

                <small>
                  Assigned by
                </small>

                <strong>
                  ${escapeHTML(
                    assignedBy
                  )}
                </strong>

              </div>
            `
            : `
              <div>

                <small>
                  Student
                </small>

                <strong>
                  ${escapeHTML(
                    studentName
                  )}
                </strong>

              </div>

              <div>

                <small>
                  Assigned by
                </small>

                <strong>
                  ${escapeHTML(
                    assignedBy
                  )}
                </strong>

              </div>
            `
        }

        <div>

          <small>
            Due date
          </small>

          <strong>
            ${escapeHTML(
              due
            )}
          </strong>

        </div>

        <div>

          <small>
            Assigned
          </small>

          <strong>
            ${escapeHTML(
              formatDateTime(
                getTaskDate(task)
              )
            )}
          </strong>

        </div>

      </div>

      ${
        buttons.length
          ? `
            <div class="task-actions">
              ${buttons.join("")}
            </div>
          `
          : ""
      }

    </div>
  `;
}

function renderTasks() {
  const container =
    $("allTasksContainer") ||
    $("tasksList");

  if (!container) return;

  let tasks =
    [...state.tasks];

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

  if (search) {

    tasks =
      tasks.filter(
        task =>
          [
            task.title,
            task.description,
            task.assignedToName,
            task.assignedByName
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
      );
  }

  if (filter !== "all") {

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
      `<div class="empty-state">
        <p>No tasks found.</p>
      </div>`;

    return;
  }

  container.innerHTML =
    tasks
      .map(taskCardHTML)
      .join("");

  attachTaskActions(
    container
  );
}

function renderRecentTasks() {
  const container =
    $("recentTasksContainer") ||
    $("recentTasks");

  if (!container) return;

  const recent =
    [...state.tasks]
      .sort(
        (a, b) =>
          (
            b.assignedAt
              ?.toMillis?.() ||
            0
          ) -
          (
            a.assignedAt
              ?.toMillis?.() ||
            0
          )
      )
      .slice(
        0,
        5
      );

  if (!recent.length) {

    container.innerHTML =
      `<div class="empty-state">
        <p>No recent tasks.</p>
      </div>`;

    return;
  }

  container.innerHTML =
    recent
      .map(taskCardHTML)
      .join("");

  attachTaskActions(
    container
  );
}

function attachTaskActions(
  container
) {
  container
    .querySelectorAll(
      "[data-task-action]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async event => {

            event.preventDefault();
            event.stopPropagation();

            await handleTaskAction(
              button.dataset.taskAction,
              button.dataset.taskId
            );

          }
        );

      }
    );
}

// ============================================================
// TASK ACTIONS
// ============================================================

async function handleTaskAction(
  action,
  taskId
) {
  const task =
    state.tasks.find(
      item =>
        item.id === taskId
    );

  if (!task) {

    showToast(
      "Task not found.",
      "error"
    );

    return;
  }

  const role =
    state.profile?.role;

  if (
    role === "student" &&
    task.assignedTo !==
      state.user.uid
  ) {

    showToast(
      "This task is not assigned to you.",
      "error"
    );

    return;
  }

  const updates = {};

  if (
    action === "accept" &&
    role === "student"
  ) {

    updates.status =
      "accepted";

    updates.acceptedAt =
      serverTimestamp();

  } else if (
    action === "start" &&
    role === "student"
  ) {

    updates.status =
      "in_progress";

    updates.startedAt =
      serverTimestamp();

  } else if (
    action === "complete" &&
    role === "student"
  ) {

    updates.status =
      "completed";

    updates.completedAt =
      serverTimestamp();

    const started =
      task.startedAt
        ?.toMillis?.() ||
      0;

    if (started) {

      updates.durationMs =
        Math.max(
          0,
          Date.now() -
          started
        );
    }

  } else if (
    action === "delete" &&
    (
      role === "admin" ||
      role === "superadmin"
    )
  ) {

    if (
      role === "admin" &&
      task.assignedBy !==
        state.user.uid
    ) {

      showToast(
        "You can only delete tasks assigned by you.",
        "error"
      );

      return;
    }

    if (
      !window.confirm(
        "Delete this task?"
      )
    ) {
      return;
    }

    try {

      await deleteDoc(
        doc(
          db,
          "tasks",
          taskId
        )
      );

      state.tasks =
        state.tasks.filter(
          item =>
            item.id !==
            taskId
        );

      renderTasks();
      renderRecentTasks();
      updateDashboard();
      renderProgress();

      showToast(
        "Task deleted."
      );

    } catch (error) {

      showToast(
        firebaseError(error),
        "error"
      );
    }

    return;

  } else {

    showToast(
      "You cannot perform this action.",
      "error"
    );

    return;
  }

  try {

    await updateDoc(
      doc(
        db,
        "tasks",
        taskId
      ),
      updates
    );

    await loadTasks();

    showToast(
      action === "accept"
        ? "Task accepted."
        : action === "start"
        ? "Task started."
        : action === "complete"
        ? "Task completed."
        : "Task updated."
    );

  } catch (error) {

    showToast(
      firebaseError(error),
      "error"
    );
  }
}

// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard() {
  const tasks =
    state.tasks || [];

  const total =
    tasks.length;

  const completed =
    tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  const pending =
    tasks.filter(
      task =>
        !task.status ||
        task.status ===
          "pending"
    ).length;

  const inProgress =
    tasks.filter(
      task =>
        task.status ===
          "in_progress" ||
        task.status ===
          "accepted"
    ).length;

  const percentage =
    total
      ? Math.round(
          completed /
          total *
          100
        )
      : 0;

  const values = {

    statTotalTasks:
      total,

    statPending:
      pending,

    statInProgress:
      inProgress,

    statCompleted:
      completed,

    totalTasks:
      total,

    pendingTasks:
      pending,

    activeTasks:
      inProgress,

    completedTasks:
      completed,

    totalUsers:
      state.users.length
  };

  Object.entries(
    values
  ).forEach(
    ([id, value]) => {

      if ($(id)) {
        $(id).textContent =
          value;
      }

    }
  );

  if ($("dashboardGreeting")) {

    $("dashboardGreeting")
      .textContent =
      `Welcome back, ${
        state.profile?.name ||
        state.user?.displayName ||
        "User"
      }!`;
  }

  if ($("overviewPercentage")) {

    $("overviewPercentage")
      .textContent =
      `${percentage}%`;
  }

  if ($("overviewProgress")) {

    $("overviewProgress")
      .style.width =
      `${percentage}%`;
  }
}

// ============================================================
// PROGRESS
// ============================================================

function calculateStudentProgress(
  studentId
) {
  const tasks =
    state.tasks.filter(
      task =>
        task.assignedTo ===
        studentId
    );

  const total =
    tasks.length;

  const completed =
    tasks.filter(
      task =>
        task.status ===
        "completed"
    ).length;

  const inProgress =
    tasks.filter(
      task =>
        task.status ===
          "in_progress" ||
        task.status ===
          "accepted"
    ).length;

  const pending =
    tasks.filter(
      task =>
        !task.status ||
        task.status ===
          "pending"
    ).length;

  const percentage =
    total
      ? Math.round(
          completed /
          total *
          100
        )
      : 0;

  return {
    total,
    completed,
    inProgress,
    pending,
    percentage
  };
}

function buildStudentOwnProgress() {

  const progress =
    calculateStudentProgress(
      state.user.uid
    );

  return `
    <div class="progress-detail-card">

      <h3>
        My Progress
      </h3>

      <div class="progress-stat-grid">

        <div>
          <strong>
            ${progress.total}
          </strong>

          <span>
            Total
          </span>
        </div>

        <div>
          <strong>
            ${progress.completed}
          </strong>

          <span>
            Completed
          </span>
        </div>

        <div>
          <strong>
            ${progress.inProgress}
          </strong>

          <span>
            Active
          </span>
        </div>

        <div>
          <strong>
            ${progress.pending}
          </strong>

          <span>
            Pending
          </span>
        </div>

      </div>

      <div class="progress-bar">

        <div
          class="progress-fill"
          style="width:${progress.percentage}%"
        ></div>

      </div>

      <div class="progress-percent">
        ${progress.percentage}% completed
      </div>

    </div>
  `;
}

function renderProgress() {

  const container =
    $("progressContainer") ||
    $("allStudentsProgress");

  const summary =
    $("progressSummary") ||
    $("individualProgress");

  if (
    state.selectedStudentId &&
    summary
  ) {

    const student =
      state.users.find(
        user =>
          (
            user.uid ||
            user.id
          ) ===
          state.selectedStudentId
      );

    if (student) {

      const progress =
        calculateStudentProgress(
          state.selectedStudentId
        );

      summary.innerHTML = `
        <div class="progress-detail-card">

          <div class="progress-detail-header">

            <div class="user-avatar">
              ${escapeHTML(
                (
                  student.name ||
                  "S"
                )
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>

            <div>

              <h3>
                ${escapeHTML(
                  student.name ||
                  "Student"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  student.email ||
                  ""
                )}
              </p>

            </div>

          </div>

          <div class="progress-stat-grid">

            <div>
              <strong>
                ${progress.total}
              </strong>

              <span>
                Total
              </span>
            </div>

            <div>
              <strong>
                ${progress.completed}
              </strong>

              <span>
                Completed
              </span>
            </div>

            <div>
              <strong>
                ${progress.inProgress}
              </strong>

              <span>
                Active
              </span>
            </div>

            <div>
              <strong>
                ${progress.pending}
              </strong>

              <span>
                Pending
              </span>
            </div>

          </div>

          <div class="progress-bar">

            <div
              class="progress-fill"
              style="width:${progress.percentage}%"
            ></div>

          </div>

          <div class="progress-percent">
            ${progress.percentage}% completed
          </div>

        </div>
      `;
    }
  }

  if (!container) return;

  if (
    !["admin", "superadmin"]
      .includes(
        state.profile?.role
      )
  ) {

    if (!state.selectedStudentId) {
      container.innerHTML =
        buildStudentOwnProgress();
    }

    return;
  }

  if (!state.users.length) {

    container.innerHTML =
      `<div class="empty-state">
        <p>No students found.</p>
      </div>`;

    return;
  }

  container.innerHTML =
    state.users
      .map(student => {

        const id =
          student.uid ||
          student.id;

        const progress =
          calculateStudentProgress(
            id
          );

        return `
          <div
            class="student-progress-card"
            data-progress-student="${escapeHTML(id)}"
          >

            <div class="progress-student-header">

              <div class="user-avatar">
                ${escapeHTML(
                  (
                    student.name ||
                    "S"
                  )
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <div>

                <h3>
                  ${escapeHTML(
                    student.name ||
                    "Student"
                  )}
                </h3>

                <p>
                  ${escapeHTML(
                    student.email ||
                    ""
                  )}
                </p>

              </div>

            </div>

            <div class="progress-info">

              <div class="progress-top">

                <span>
                  ${progress.completed}
                  /
                  ${progress.total}
                  completed
                </span>

                <strong>
                  ${progress.percentage}%
                </strong>

              </div>

              <div class="progress-bar">

                <div
                  class="progress-fill"
                  style="width:${progress.percentage}%"
                ></div>

              </div>

            </div>

          </div>
        `;
      })
      .join("");

  container
    .querySelectorAll(
      "[data-progress-student]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          state.selectedStudentId =
            card.dataset
              .progressStudent;

          renderProgress();
        }
      );

    });
}

// ============================================================
// SUPER ADMIN
// ============================================================

async function renderSuperAdminUsers() {

  if (
    state.profile?.role !==
    "superadmin"
  ) {
    return;
  }

  try {

    const snapshot =
      await getDocs(
        query(
          collection(db, "users"),
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
          id: item.id,
          ...item.data()
        })
      );

    const container =
      $("superAdminUsers");

    if (!container) return;

    if (!admins.length) {

      container.innerHTML =
        `<div class="empty-state">
          <p>No administrators found.</p>
        </div>`;

      return;
    }

    container.innerHTML =
      admins
        .map(admin => {

          const adminTasks =
            state.tasks.filter(
              task =>
                task.assignedBy ===
                admin.uid
            );

          const studentIds =
            [
              ...new Set(
                adminTasks
                  .map(
                    task =>
                      task.assignedTo
                  )
                  .filter(Boolean)
              )
            ];

          return `
            <div class="admin-monitor-card">

              <h3>
                ${escapeHTML(
                  admin.name ||
                  "Admin"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  admin.email ||
                  ""
                )}
              </p>

              <small>
                Created:
                ${escapeHTML(
                  formatDateTime(
                    admin.createdAt
                  )
                )}
              </small>

              <div>
                Students:
                ${studentIds.length}
              </div>

              <div>
                Tasks:
                ${adminTasks.length}
              </div>

            </div>
          `;
        })
        .join("");

  } catch (error) {

    console.error(
      "renderSuperAdminUsers:",
      error
    );
  }
}

// ============================================================
// START APPLICATION
// ============================================================

async function startApplication() {

  if (!state.user) {
    return;
  }

  state.loading = true;

  state.startupFinished =
    false;

  clearStartupError();

  try {

    await loadProfile();

    const role =
      state.profile?.role;

    if (!role) {

      throw new Error(
        "The Firebase user profile does not contain a role."
      );
    }

    if ($("authScreen")) {
      $("authScreen").style.display =
        "none";
    }

    if ($("mainApp")) {
      $("mainApp").style.display =
        "";
    }

    if ($("usersNavItem")) {

      $("usersNavItem").style.display =
        role === "admin" ||
        role === "superadmin"
          ? ""
          : "none";
    }

    if ($("progressNavItem")) {

      $("progressNavItem").style.display =
        "";
    }

    await loadUsers();

    await loadTasks();

    await renderSuperAdminUsers();

    showPage(
      "dashboard"
    );

    state.startupFinished =
      true;

    stopStartupTimer();

  } catch (error) {

    state.startupFinished =
      false;

    showStartupError(
      error,
      "Starting Task Manager"
    );

  } finally {

    state.loading =
      false;
  }
}

function showLoggedOutScreen() {

  state.startupFinished =
    false;

  if ($("authScreen")) {
    $("authScreen").style.display =
      "";
  }

  if ($("mainApp")) {
    $("mainApp").style.display =
      "none";
  }

  clearStartupError();

  showLoginPanel();
}

// ============================================================
// EVENTS
// ============================================================

function setupNavigation() {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(item => {

      item.addEventListener(
        "click",
        () => {

          if (
            item.dataset.page
          ) {

            showPage(
              item.dataset.page
            );
          }

        }
      );
    });

  $("usersNavItem")
    ?.addEventListener(
      "click",
      () =>
        showPage(
          "users"
        )
    );

  $("progressNavItem")
    ?.addEventListener(
      "click",
      () =>
        showPage(
          "progress"
        )
    );
}

function setupAuthEvents() {

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

  document
    .querySelectorAll(
      "[data-show-register], #showRegister"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          showRegisterPanel();
        }
      );
    });

  document
    .querySelectorAll(
      "[data-show-login], #showLogin"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          showLoginPanel();
        }
      );
    });

  document
    .querySelectorAll(
      "[data-logout], #logoutBtn, #logoutButton"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          logoutUser();
        }
      );
    });
}

function setupForms() {

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
}

function setupModals() {

  $("addUserBtn")
    ?.addEventListener(
      "click",
      () => {

        if (
          !["admin", "superadmin"]
            .includes(
              state.profile?.role
            )
        ) {

          showToast(
            "You do not have permission.",
            "error"
          );

          return;
        }

        openModal(
          "userModal"
        );
      }
    );

  $("addTaskBtn")
    ?.addEventListener(
      "click",
      () => {

        if (
          !["admin", "superadmin"]
            .includes(
              state.profile?.role
            )
        ) {

          showToast(
            "You do not have permission.",
            "error"
          );

          return;
        }

        populateTaskUsers();

        openModal(
          "taskModal"
        );
      }
    );

  document
    .querySelectorAll(
      "[data-close-modal], .modal-close, .close-modal"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const modal =
            button.closest(
              ".modal"
            );

          if (modal) {

            modal.classList.remove(
              "show"
            );

            modal.style.display =
              "";
          }

        }
      );
    });

  document
    .querySelectorAll(
      ".modal"
    )
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            modal
          ) {

            modal.classList.remove(
              "show"
            );

            modal.style.display =
              "";
          }

        }
      );
    });
}

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

function setupSidebar() {

  document
    .querySelectorAll(
      ".menu-toggle, #menuToggle, #hamburgerBtn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          document.body.classList.toggle(
            "sidebar-open"
          );

          document
            .querySelector(
              ".sidebar"
            )
            ?.classList.toggle(
              "open"
            );
        }
      );
    });

  document.addEventListener(
    "click",
    event => {

      const sidebar =
        document.querySelector(
          ".sidebar"
        );

      if (!sidebar) return;

      const inside =
        sidebar.contains(
          event.target
        );

      const menu =
        event.target.closest(
          ".menu-toggle, #menuToggle, #hamburgerBtn"
        );

      if (
        !inside &&
        !menu
      ) {

        closeSidebarMobile();
      }

    }
  );
}

function setupEvents() {

  setupNavigation();
  setupAuthEvents();
  setupForms();
  setupModals();
  setupTaskFilters();
  setupSidebar();
}

function setVersion() {

  document
    .querySelectorAll(
      "#appVersion, [data-app-version]"
    )
    .forEach(element => {

      element.textContent =
        `Task Manager ${VERSION}`;
    });
}

// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

window.addEventListener(
  "error",
  event => {

    console.error(
      "Global JavaScript error:",
      event.error ||
      event.message
    );

    showStartupError(
      event.error ||
        new Error(
          event.message ||
          "Unknown JavaScript error"
        ),
      "JavaScript error"
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "Unhandled promise rejection:",
      event.reason
    );

    showStartupError(
      event.reason ||
        new Error(
          "Unhandled promise error"
        ),
      "Firebase/application error"
    );
  }
);

// ============================================================
// FIREBASE AUTH LISTENER
// ============================================================

try {

  startStartupTimer();

  onAuthStateChanged(
    auth,

    async user => {

      try {

        stopStartupTimer();

        state.user =
          user;

        if (!user) {

          state.profile =
            null;

          state.users =
            [];

          state.tasks =
            [];

          showLoggedOutScreen();

          return;
        }

        await startApplication();

        updateAvatar();

      } catch (error) {

        showStartupError(
          error,
          "Firebase Authentication listener"
        );
      }

    },

    error => {

      stopStartupTimer();

      state.user =
        null;

      state.profile =
        null;

      showStartupError(
        error,
        "Firebase Authentication"
      );
    }
  );

} catch (error) {

  stopStartupTimer();

  showStartupError(
    error,
    "Firebase Authentication initialization"
  );
}

// ============================================================
// INITIALIZE
// ============================================================

function initializeInterface() {

  try {

    setupEvents();

    setVersion();

  } catch (error) {

    showStartupError(
      error,
      "Interface initialization"
    );
  }
}

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeInterface,
    {
      once: true
    }
  );

} else {

  initializeInterface();
}

// ============================================================
// DEBUG ACCESS
// ============================================================

window.TaskManager = {

  state,

  version:
    VERSION,

  reload:
    async () => {

      await loadUsers();

      await loadTasks();

      updateDashboard();
    },

  logout:
    logoutUser

};
