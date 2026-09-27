// ============================================================
// TASK MANAGER
// Version 1.0.5
// Complete Application Logic
// ============================================================

import {
  app,
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
  getFirestore,
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


// ============================================================
// VERSION
// ============================================================

const VERSION = "v1.0.5";


// ============================================================
// STATE
// ============================================================

const state = {
  user: null,
  profile: null,

  users: [],
  tasks: [],

  selectedStudentId: null,
  currentPage: "dashboard",

  loading: false
};


// ============================================================
// BASIC HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getName(user) {
  if (!user) return "User";

  return (
    user.name ||
    user.displayName ||
    user.email ||
    "User"
  );
}


function getRole(user) {
  if (!user) return "";

  return user.role || "";
}


function formatDate(value) {
  if (!value) return "—";

  try {
    let date;

    if (value?.toDate) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) return "—";

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
    let date;

    if (value?.toDate) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) return "—";

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
  return task.assignedAt || task.createdAt || null;
}


function getStatusText(status) {
  const map = {
    pending: "Pending",
    accepted: "Accepted",
    in_progress: "In Progress",
    completed: "Completed"
  };

  return map[status] || "Pending";
}


function getStatusClass(status) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in-progress";
  if (status === "accepted") return "accepted";

  return "pending";
}


function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) {
    console.log(message);
    return;
  }

  const icon = $("toastIcon");
  const text = $("toastMessage");

  if (text) text.textContent = message;

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
  }, 3000);
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

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "permission-denied":
      "You do not have permission for this action.",

    "failed-precondition":
      "Firestore needs an index. Please try again.",

    "unavailable":
      "Firebase is temporarily unavailable."
  };

  return (
    messages[code] ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}


function setMessage(id, message, type = "") {
  const el = $(id);

  if (!el) return;

  el.textContent = message;

  el.className = "";

  if (type) {
    el.classList.add(type);
  }
}


function closeModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("show");
  modal.style.display = "";
}


function openModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.add("show");
  modal.style.display = "flex";
}


// ============================================================
// SIDEBAR / PAGE NAVIGATION
// ============================================================

function showPage(page) {
  state.currentPage = page;

  const pages = [
    "dashboardPage",
    "usersPage",
    "tasksPage",
    "progressPage",
    "profilePage"
  ];

  pages.forEach(id => {
    const el = $(id);

    if (!el) return;

    const shouldShow = id === `${page}Page`;

    el.style.display = shouldShow ? "" : "none";
    el.classList.toggle("active", shouldShow);
  });

  document.querySelectorAll("[data-page]").forEach(item => {
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


function closeSidebarMobile() {
  document.body.classList.remove("sidebar-open");

  const sidebar = document.querySelector(".sidebar");

  if (sidebar) {
    sidebar.classList.remove("open");
  }
}


function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(item => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;

      if (!page) return;

      showPage(page);
    });
  });

  const usersNav = $("usersNavItem");

  if (usersNav) {
    usersNav.addEventListener("click", () => {
      showPage("users");
    });
  }

  const progressNav = $("progressNavItem");

  if (progressNav) {
    progressNav.addEventListener("click", () => {
      showPage("progress");
    });
  }
}


// ============================================================
// AUTH
// ============================================================

async function loginUser(event) {
  event.preventDefault();

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    setMessage(
      "loginMessage",
      "Please enter email and password.",
      "error"
    );

    return;
  }

  setMessage("loginMessage", "Signing in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    setMessage("loginMessage", "");

    showToast("Login successful.");
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

  const name = $("registerName")?.value.trim();
  const email = $("registerEmail")?.value.trim();
  const password = $("registerPassword")?.value;
  const confirmPassword =
    $("registerConfirmPassword")?.value;

  if (!name || !email || !password || !confirmPassword) {
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

  setMessage("registerMessage", "Creating account...");

  try {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const newUser = credential.user;

    await updateProfile(newUser, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", newUser.uid),
      {
        uid: newUser.uid,
        name,
        email,
        role: "admin",
        active: true,
        createdAt: serverTimestamp()
      }
    );

    setMessage(
      "registerMessage",
      "Admin account created successfully."
    );

    showToast("Admin account created.");

    if ($("registerForm")) {
      $("registerForm").reset();
    }

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


function showLoginPanel() {
  const loginPanel = $("loginPanel");
  const registerPanel = $("registerPanel");

  if (loginPanel) {
    loginPanel.style.display = "";
  }

  if (registerPanel) {
    registerPanel.style.display = "none";
  }
}


function showRegisterPanel() {
  const loginPanel = $("loginPanel");
  const registerPanel = $("registerPanel");

  if (loginPanel) {
    loginPanel.style.display = "none";
  }

  if (registerPanel) {
    registerPanel.style.display = "";
  }
}


async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    showToast(firebaseError(error), "error");
  }
}


// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {
  if (!state.user) return;

  const profileRef = doc(
    db,
    "users",
    state.user.uid
  );

  const snapshot = await getDoc(profileRef);

  if (snapshot.exists()) {
    state.profile = {
      id: snapshot.id,
      ...snapshot.data()
    };
  } else {
    state.profile = {
      uid: state.user.uid,
      name: state.user.displayName || "User",
      email: state.user.email || "",
      role: "student",
      active: true
    };
  }

  updateUserUI();
}


function updateUserUI() {
  const profile = state.profile || {};
  const authUser = state.user || {};

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

  document.querySelectorAll(
    "[data-user-name]"
  ).forEach(el => {
    el.textContent = name;
  });

  document.querySelectorAll(
    "[data-user-email]"
  ).forEach(el => {
    el.textContent = email;
  });

  document.querySelectorAll(
    "[data-user-role]"
  ).forEach(el => {
    el.textContent = roleText;
  });

  const nameIds = [
    "headerUserName",
    "sidebarName",
    "profileName",
    "profileNameDetail"
  ];

  nameIds.forEach(id => {
    const el = $(id);

    if (el) el.textContent = name;
  });

  const roleIds = [
    "headerUserRole",
    "sidebarRole",
    "profileRole",
    "profileRoleDetail"
  ];

  roleIds.forEach(id => {
    const el = $(id);

    if (el) el.textContent = roleText;
  });

  const emailEl = $("profileEmail");

  if (emailEl) {
    emailEl.textContent = email;
  }

  const statusEl = $("profileStatus");

  if (statusEl) {
    statusEl.textContent =
      profile.active === false
        ? "Inactive"
        : "Active";
  }

  const versionEls =
    document.querySelectorAll(
      "#appVersion, [data-app-version]"
    );

  versionEls.forEach(el => {
    el.textContent = `Task Manager ${VERSION}`;
  });
}


function renderProfile() {
  updateUserUI();
}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {
  if (!state.profile) return;

  try {
    if (
      state.profile.role === "admin" ||
      state.profile.role === "superadmin"
    ) {
      const usersQuery = query(
        collection(db, "users"),
        where("role", "==", "student")
      );

      const snapshot = await getDocs(usersQuery);

      state.users = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

    } else {
      const ownRef = doc(
        db,
        "users",
        state.user.uid
      );

      const snapshot = await getDoc(ownRef);

      state.users = snapshot.exists()
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
    console.error("loadUsers:", error);

    showToast(
      firebaseError(error),
      "error"
    );
  }
}


// ============================================================
// RENDER USERS
// ============================================================

function renderUsers() {
  const container =
    $("usersContainer") ||
    $("usersList");

  if (!container) return;

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {
    container.innerHTML = `
      <div class="empty-state">
        <p>User management is available to administrators.</p>
      </div>
    `;

    return;
  }

  if (!state.users.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No students found.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = state.users.map(user => {

    const userTasks =
      state.tasks.filter(
        task => task.assignedTo === user.uid
      );

    const completed =
      userTasks.filter(
        task => task.status === "completed"
      ).length;

    const total = userTasks.length;

    const percentage =
      total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    return `
      <div class="user-card" data-student-id="${escapeHTML(user.uid || user.id)}">

        <div class="user-card-main">

          <div class="user-avatar">
            ${escapeHTML(
              (user.name || "S").charAt(0).toUpperCase()
            )}
          </div>

          <div class="user-info">
            <h3>${escapeHTML(user.name || "Student")}</h3>

            <p>${escapeHTML(user.email || "")}</p>

            <span class="user-role">
              Student
            </span>
          </div>

        </div>

        <div class="user-progress">

          <div class="progress-top">
            <span>Progress</span>
            <strong>${percentage}%</strong>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width:${percentage}%"
            ></div>
          </div>

          <small>
            ${completed} of ${total} tasks completed
          </small>

        </div>

        <div class="user-meta">
          <small>
            Created by:
            ${escapeHTML(user.createdByName || "—")}
          </small>
        </div>

      </div>
    `;
  }).join("");

  container
    .querySelectorAll("[data-student-id]")
    .forEach(card => {

      card.addEventListener("click", () => {

        const studentId =
          card.dataset.studentId;

        state.selectedStudentId =
          studentId;

        showPage("progress");
      });
    });
}


// ============================================================
// CREATE STUDENT
// ============================================================

async function createUser(event) {
  event.preventDefault();

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
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

  if (!name || !email || !password) {
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

    // --------------------------------------------------------
    // CHECK EXISTING STUDENT
    // --------------------------------------------------------

    const existingQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );

    const existingSnapshot =
      await getDocs(existingQuery);

    if (!existingSnapshot.empty) {

      setMessage(
        "userMessage",
        "A user with this email already exists.",
        "error"
      );

      return;
    }


    // --------------------------------------------------------
    // SECONDARY FIREBASE APP
    // --------------------------------------------------------

    const firebaseConfig =
      app.options;

    secondaryApp =
      initializeSecondaryApp(
        firebaseConfig,
        `SecondaryApp-${Date.now()}`
      );

    secondaryAuth =
      getSecondaryAuth(
        secondaryApp
      );


    // --------------------------------------------------------
    // CREATE AUTH USER
    // --------------------------------------------------------

    const credential =
      await createSecondaryUser(
        secondaryAuth,
        email,
        password
      );

    const student =
      credential.user;


    // --------------------------------------------------------
    // UPDATE DISPLAY NAME
    // --------------------------------------------------------

    await updateSecondaryProfile(
      student,
      {
        displayName: name
      }
    );


    // --------------------------------------------------------
    // CREATE FIRESTORE PROFILE
    // --------------------------------------------------------

    await setDoc(
      doc(db, "users", student.uid),
      {
        uid: student.uid,
        name,
        email,
        role: "student",
        active: true,

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


    // --------------------------------------------------------
    // CLEAN SECONDARY AUTH
    // --------------------------------------------------------

    try {
      await signOutSecondary(
        secondaryAuth
      );
    } catch {}


    await deleteApp(
      secondaryApp
    );

    secondaryApp = null;


    // --------------------------------------------------------
    // REFRESH
    // --------------------------------------------------------

    await loadUsers();

    closeModal("userModal");

    if ($("userForm")) {
      $("userForm").reset();
    }

    setMessage(
      "userMessage",
      ""
    );

    showToast(
      "Student account created successfully."
    );

  } catch (error) {

    console.error(
      "createUser:",
      error
    );

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
// LOAD TASKS
// ============================================================

async function loadTasks() {
  if (!state.profile) return;

  try {

    if (
      state.profile.role === "admin" ||
      state.profile.role === "superadmin"
    ) {

      try {

        const tasksQuery = query(
          collection(db, "tasks"),
          orderBy("assignedAt", "desc")
        );

        const snapshot =
          await getDocs(tasksQuery);

        state.tasks =
          snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));

      } catch (indexError) {

        console.warn(
          "Ordered task query failed. Loading without order.",
          indexError
        );

        const snapshot =
          await getDocs(
            collection(db, "tasks")
          );

        state.tasks =
          snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));

        state.tasks.sort(
          (a, b) =>
            getTaskDate(b)?.toMillis?.() -
              getTaskDate(a)?.toMillis?.() || 0
        );
      }

    } else {

      const tasksQuery = query(
        collection(db, "tasks"),
        where(
          "assignedTo",
          "==",
          state.user.uid
        )
      );

      const snapshot =
        await getDocs(tasksQuery);

      state.tasks =
        snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

      state.tasks.sort(
        (a, b) => {

          const aDate =
            getTaskDate(a)?.toMillis?.() || 0;

          const bDate =
            getTaskDate(b)?.toMillis?.() || 0;

          return bDate - aDate;
        }
      );
    }

    updateDashboard();
    renderTasks();
    renderRecentTasks();
    renderProgress();
    renderUsers();

  } catch (error) {

    console.error(
      "loadTasks:",
      error
    );

    showToast(
      firebaseError(error),
      "error"
    );
  }
}


// ============================================================
// TASK USER DROPDOWN
// ============================================================

function populateTaskUsers() {
  const select = $("taskUser");

  if (!select) return;

  const currentValue =
    select.value;

  select.innerHTML = `
    <option value="">
      Select student
    </option>
  `;

  state.users.forEach(user => {

    const option =
      document.createElement("option");

    option.value =
      user.uid || user.id;

    option.textContent =
      user.name ||
      user.email ||
      "Student";

    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
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
    $("taskDueDate")?.value || null;

  if (!title || !assignedTo) {
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
        (user.uid || user.id) ===
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

    closeModal("taskModal");

    if ($("taskForm")) {
      $("taskForm").reset();
    }

    setMessage(
      "taskMessage",
      ""
    );

    await loadTasks();

    showToast(
      "Task assigned successfully."
    );

  } catch (error) {

    console.error(
      "createTask:",
      error
    );

    setMessage(
      "taskMessage",
      firebaseError(error),
      "error"
    );
  }
}


// ============================================================
// TASK CARD HTML
// ============================================================

function taskCardHTML(task, options = {}) {

  const role =
    state.profile?.role;

  const isStudent =
    role === "student";

  const canManage =
    role === "admin" ||
    role === "superadmin";

  const status =
    task.status || "pending";

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
            ${escapeHTML(task.title || "Untitled Task")}
          </h3>

          <span class="task-status ${getStatusClass(status)}">
            ${getStatusText(status)}
          </span>
        </div>

      </div>

      ${
        task.description
          ? `
            <p class="task-description">
              ${escapeHTML(task.description)}
            </p>
          `
          : ""
      }

      <div class="task-details">

        ${
          isStudent
            ? `
              <div>
                <small>Assigned by</small>
                <strong>
                  ${escapeHTML(assignedBy)}
                </strong>
              </div>
            `
            : `
              <div>
                <small>Student</small>
                <strong>
                  ${escapeHTML(studentName)}
                </strong>
              </div>

              <div>
                <small>Assigned by</small>
                <strong>
                  ${escapeHTML(assignedBy)}
                </strong>
              </div>
            `
        }

        <div>
          <small>Due date</small>
          <strong>${escapeHTML(due)}</strong>
        </div>

        <div>
          <small>Assigned</small>
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


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks() {

  const container =
    $("allTasksContainer") ||
    $("tasksList");

  if (!container) return;

  let tasks =
    [...state.tasks];

  const search =
    $("taskSearch")?.value
      .trim()
      .toLowerCase() || "";

  const filter =
    $("taskStatusFilter")?.value || "all";

  if (search) {
    tasks = tasks.filter(task => {

      const text = [
        task.title,
        task.description,
        task.assignedToName,
        task.assignedByName
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }

  if (filter !== "all") {
    tasks = tasks.filter(
      task =>
        (task.status || "pending") === filter
    );
  }

  if (!tasks.length) {

    container.innerHTML = `
      <div class="empty-state">
        <p>No tasks found.</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    tasks.map(task =>
      taskCardHTML(task)
    ).join("");

  attachTaskActions(container);
}


// ============================================================
// RECENT TASKS
// ============================================================

function renderRecentTasks() {

  const container =
    $("recentTasksContainer") ||
    $("recentTasks");

  if (!container) return;

  const recent =
    [...state.tasks]
      .sort((a, b) => {

        const aTime =
          getTaskDate(a)?.toMillis?.() || 0;

        const bTime =
          getTaskDate(b)?.toMillis?.() || 0;

        return bTime - aTime;
      })
      .slice(0, 5);

  if (!recent.length) {

    container.innerHTML = `
      <div class="empty-state">
        <p>No recent tasks.</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    recent.map(task =>
      taskCardHTML(
        task,
        { recent: true }
      )
    ).join("");

  attachTaskActions(container);
}


// ============================================================
// TASK ACTIONS
// ============================================================

function attachTaskActions(container) {

  container
    .querySelectorAll("[data-task-action]")
    .forEach(button => {

      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();
          event.stopPropagation();

          const action =
            button.dataset.taskAction;

          const taskId =
            button.dataset.taskId;

          if (!taskId) return;

          await handleTaskAction(
            action,
            taskId
          );
        }
      );
    });
}


async function handleTaskAction(
  action,
  taskId
) {

  const task =
    state.tasks.find(
      item => item.id === taskId
    );

  if (!task) {
    showToast(
      "Task not found.",
      "error"
    );

    return;
  }

  const now =
    serverTimestamp();

  const updates = {};


  // ----------------------------------------------------------
  // STUDENT ACCEPT
  // ----------------------------------------------------------

  if (
    action === "accept" &&
    state.profile?.role === "student"
  ) {

    if (task.assignedTo !== state.user.uid) {
      showToast(
        "This task is not assigned to you.",
        "error"
      );

      return;
    }

    updates.status = "accepted";
    updates.acceptedAt = now;
  }


  // ----------------------------------------------------------
  // STUDENT START
  // ----------------------------------------------------------

  else if (
    action === "start" &&
    state.profile?.role === "student"
  ) {

    if (task.assignedTo !== state.user.uid) {
      showToast(
        "This task is not assigned to you.",
        "error"
      );

      return;
    }

    updates.status = "in_progress";
    updates.startedAt = now;
  }


  // ----------------------------------------------------------
  // STUDENT COMPLETE
  // ----------------------------------------------------------

  else if (
    action === "complete" &&
    state.profile?.role === "student"
  ) {

    if (task.assignedTo !== state.user.uid) {
      showToast(
        "This task is not assigned to you.",
        "error"
      );

      return;
    }

    updates.status = "completed";
    updates.completedAt = now;

    const started =
      task.startedAt?.toMillis?.() || 0;

    if (started) {
      updates.durationMs =
        Math.max(
          0,
          Date.now() - started
        );
    }
  }


  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  else if (
    action === "delete" &&
    (
      state.profile?.role === "admin" ||
      state.profile?.role === "superadmin"
    )
  ) {

    if (
      state.profile.role === "admin" &&
      task.assignedBy !== state.user.uid
    ) {
      showToast(
        "You can only delete tasks assigned by you.",
        "error"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Delete this task?"
      );

    if (!confirmed) return;

    try {

      await deleteDoc(
        doc(db, "tasks", taskId)
      );

      state.tasks =
        state.tasks.filter(
          item => item.id !== taskId
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
  }


  // ----------------------------------------------------------
  // INVALID ACTION
  // ----------------------------------------------------------

  else {

    showToast(
      "You cannot perform this action.",
      "error"
    );

    return;
  }


  // ----------------------------------------------------------
  // UPDATE TASK
  // ----------------------------------------------------------

  try {

    await updateDoc(
      doc(db, "tasks", taskId),
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

    console.error(
      "handleTaskAction:",
      error
    );

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
        task.status === "completed"
    ).length;

  const pending =
    tasks.filter(
      task =>
        !task.status ||
        task.status === "pending"
    ).length;

  const inProgress =
    tasks.filter(
      task =>
        task.status === "in_progress" ||
        task.status === "accepted"
    ).length;

  const percentage =
    total > 0
      ? Math.round(
          (completed / total) * 100
        )
      : 0;


  // New HTML IDs

  const values = {
    statTotalTasks: total,
    statPending: pending,
    statInProgress: inProgress,
    statCompleted: completed,

    totalTasks: total,
    pendingTasks: pending,
    activeTasks: inProgress,
    completedTasks: completed
  };

  Object.entries(values)
    .forEach(([id, value]) => {

      const el = $(id);

      if (el) {
        el.textContent = value;
      }
    });


  // Greeting

  const greeting =
    $("dashboardGreeting");

  if (greeting) {

    const name =
      state.profile?.name ||
      state.user?.displayName ||
      "User";

    greeting.textContent =
      `Welcome back, ${name}!`;
  }


  // Overview percentage

  const overviewPercentage =
    $("overviewPercentage");

  if (overviewPercentage) {
    overviewPercentage.textContent =
      `${percentage}%`;
  }


  // Overview progress bar

  const overviewProgress =
    $("overviewProgress");

  if (overviewProgress) {

    if (
      overviewProgress.style &&
      overviewProgress.style.setProperty
    ) {
      overviewProgress.style.setProperty(
        "width",
        `${percentage}%`
      );
    }
  }


  // Total users

  const totalUsers =
    $("totalUsers");

  if (totalUsers) {
    totalUsers.textContent =
      state.users.length;
  }
}


// ============================================================
// PROGRESS
// ============================================================

function calculateStudentProgress(studentId) {

  const tasks =
    state.tasks.filter(
      task =>
        task.assignedTo === studentId
    );

  const total =
    tasks.length;

  const completed =
    tasks.filter(
      task =>
        task.status === "completed"
    ).length;

  const inProgress =
    tasks.filter(
      task =>
        task.status === "in_progress" ||
        task.status === "accepted"
    ).length;

  const pending =
    tasks.filter(
      task =>
        !task.status ||
        task.status === "pending"
    ).length;

  const percentage =
    total > 0
      ? Math.round(
          (completed / total) * 100
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


function renderProgress() {

  const container =
    $("progressContainer") ||
    $("allStudentsProgress");

  const summary =
    $("progressSummary") ||
    $("individualProgress");


  // ----------------------------------------------------------
  // SELECTED STUDENT
  // ----------------------------------------------------------

  if (
    state.selectedStudentId &&
    summary
  ) {

    const student =
      state.users.find(
        user =>
          (user.uid || user.id) ===
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
                (student.name || "S")
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>

            <div>
              <h3>
                ${escapeHTML(
                  student.name || "Student"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  student.email || ""
                )}
              </p>
            </div>

          </div>

          <div class="progress-stat-grid">

            <div>
              <strong>
                ${progress.total}
              </strong>
              <span>Total</span>
            </div>

            <div>
              <strong>
                ${progress.completed}
              </strong>
              <span>Completed</span>
            </div>

            <div>
              <strong>
                ${progress.inProgress}
              </strong>
              <span>Active</span>
            </div>

            <div>
              <strong>
                ${progress.pending}
              </strong>
              <span>Pending</span>
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


  // ----------------------------------------------------------
  // ALL STUDENTS
  // ----------------------------------------------------------

  if (!container) return;

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {

    if (!state.selectedStudentId) {

      container.innerHTML =
        buildStudentOwnProgress();
    }

    return;
  }


  if (!state.users.length) {

    container.innerHTML = `
      <div class="empty-state">
        <p>No students found.</p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    state.users.map(student => {

      const id =
        student.uid ||
        student.id;

      const progress =
        calculateStudentProgress(id);

      return `
        <div
          class="student-progress-card"
          data-progress-student="${escapeHTML(id)}"
        >

          <div class="progress-student-header">

            <div class="user-avatar">
              ${escapeHTML(
                (student.name || "S")
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>

            <div>
              <h3>
                ${escapeHTML(
                  student.name || "Student"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  student.email || ""
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
    }).join("");


  container
    .querySelectorAll(
      "[data-progress-student]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          state.selectedStudentId =
            card.dataset.progressStudent;

          renderProgress();
        }
      );
    });
}


function buildStudentOwnProgress() {

  const progress =
    calculateStudentProgress(
      state.user.uid
    );

  return `
    <div class="progress-detail-card">

      <h3>My Progress</h3>

      <div class="progress-stat-grid">

        <div>
          <strong>
            ${progress.total}
          </strong>
          <span>Total</span>
        </div>

        <div>
          <strong>
            ${progress.completed}
          </strong>
          <span>Completed</span>
        </div>

        <div>
          <strong>
            ${progress.inProgress}
          </strong>
          <span>Active</span>
        </div>

        <div>
          <strong>
            ${progress.pending}
          </strong>
          <span>Pending</span>
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


// ============================================================
// SUPER ADMIN MONITORING
// ============================================================

async function renderSuperAdminUsers() {

  if (
    state.profile?.role !== "superadmin"
  ) {
    return;
  }

  try {

    const snapshot =
      await getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "admin")
        )
      );

    const admins =
      snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

    const container =
      $("superAdminUsers");

    if (!container) return;

    if (!admins.length) {

      container.innerHTML = `
        <div class="empty-state">
          <p>No administrators found.</p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      admins.map(admin => {

        const adminTasks =
          state.tasks.filter(
            task =>
              task.assignedBy === admin.uid
          );

        const studentIds =
          [
            ...new Set(
              adminTasks.map(
                task =>
                  task.assignedTo
              )
            )
          ];

        return `
          <div class="admin-monitor-card">

            <h3>
              ${escapeHTML(
                admin.name || "Admin"
              )}
            </h3>

            <p>
              ${escapeHTML(
                admin.email || ""
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
      }).join("");

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

  if (!state.user) return;

  try {

    state.loading = true;

    await loadProfile();

    updateUserUI();

    // Hide auth screen

    const authScreen =
      $("authScreen");

    const mainApp =
      $("mainApp");

    if (authScreen) {
      authScreen.style.display =
        "none";
    }

    if (mainApp) {
      mainApp.style.display =
        "";
    }


    // --------------------------------------------------------
    // ROLE BASED NAVIGATION
    // --------------------------------------------------------

    const role =
      state.profile?.role;

    const usersNav =
      $("usersNavItem");

    const progressNav =
      $("progressNavItem");

    if (usersNav) {
      usersNav.style.display =
        role === "admin" ||
        role === "superadmin"
          ? ""
          : "none";
    }

    if (progressNav) {
      progressNav.style.display =
        role === "admin" ||
        role === "superadmin"
          ? ""
          : "";
    }


    // --------------------------------------------------------
    // LOAD DATA
    // --------------------------------------------------------

    await loadUsers();

    await loadTasks();

    await renderSuperAdminUsers();

    showPage("dashboard");

  } catch (error) {

    console.error(
      "startApplication:",
      error
    );

    showToast(
      firebaseError(error),
      "error"
    );

  } finally {

    state.loading = false;
  }
}


// ============================================================
// AUTH SCREEN
// ============================================================

function showLoggedOutScreen() {

  const authScreen =
    $("authScreen");

  const mainApp =
    $("mainApp");

  if (authScreen) {
    authScreen.style.display =
      "";
  }

  if (mainApp) {
    mainApp.style.display =
      "none";
  }

  showLoginPanel();
}


// ============================================================
// MODALS
// ============================================================

function setupModals() {

  const addUserBtn =
    $("addUserBtn");

  if (addUserBtn) {

    addUserBtn.addEventListener(
      "click",
      () => {

        if (
          state.profile?.role !== "admin" &&
          state.profile?.role !== "superadmin"
        ) {
          showToast(
            "You do not have permission.",
            "error"
          );

          return;
        }

        openModal("userModal");
      }
    );
  }


  const addTaskBtn =
    $("addTaskBtn");

  if (addTaskBtn) {

    addTaskBtn.addEventListener(
      "click",
      () => {

        if (
          state.profile?.role !== "admin" &&
          state.profile?.role !== "superadmin"
        ) {
          showToast(
            "You do not have permission.",
            "error"
          );

          return;
        }

        populateTaskUsers();

        openModal("taskModal");
      }
    );
  }


  // Close buttons

  document
    .querySelectorAll(
      "[data-close-modal], .modal-close, .close-modal"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const modal =
            button.closest(".modal");

          if (modal) {
            modal.classList.remove("show");
            modal.style.display = "";
          }
        }
      );
    });


  // Click outside modal

  document
    .querySelectorAll(".modal")
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target === modal
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


// ============================================================
// SEARCH / FILTER
// ============================================================

function setupTaskFilters() {

  const search =
    $("taskSearch");

  if (search) {

    search.addEventListener(
      "input",
      () => {
        renderTasks();
      }
    );
  }

  const filter =
    $("taskStatusFilter");

  if (filter) {

    filter.addEventListener(
      "change",
      () => {
        renderTasks();
      }
    );
  }
}


// ============================================================
// AUTH UI EVENTS
// ============================================================

function setupAuthEvents() {

  const loginForm =
    $("loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }


  const registerForm =
    $("registerForm");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      registerAdmin
    );
  }


  // Common buttons for switching auth panels

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


  // Logout buttons

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


// ============================================================
// FORMS
// ============================================================

function setupForms() {

  const userForm =
    $("userForm");

  if (userForm) {
    userForm.addEventListener(
      "submit",
      createUser
    );
  }


  const taskForm =
    $("taskForm");

  if (taskForm) {
    taskForm.addEventListener(
      "submit",
      createTask
    );
  }
}


// ============================================================
// SIDEBAR MENU
// ============================================================

function setupSidebar() {

  const menuButtons =
    document.querySelectorAll(
      ".menu-toggle, #menuToggle, #hamburgerBtn"
    );

  menuButtons.forEach(button => {

    button.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        document.body.classList.toggle(
          "sidebar-open"
        );

        const sidebar =
          document.querySelector(
            ".sidebar"
          );

        if (sidebar) {
          sidebar.classList.toggle(
            "open"
          );
        }
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

      const clickedInside =
        sidebar.contains(event.target);

      const clickedMenu =
        event.target.closest(
          ".menu-toggle, #menuToggle, #hamburgerBtn"
        );

      if (
        !clickedInside &&
        !clickedMenu
      ) {
        closeSidebarMobile();
      }
    }
  );
}


// ============================================================
// PROFILE / AVATAR
// ============================================================

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

    const el = $(id);

    if (el) {
      el.textContent =
        letter;
    }
  });
}


// ============================================================
// GLOBAL EVENT SETUP
// ============================================================

function setupEvents() {

  setupNavigation();

  setupAuthEvents();

  setupForms();

  setupModals();

  setupTaskFilters();

  setupSidebar();

  updateAvatar();
}


// ============================================================
// AUTH STATE LISTENER
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    state.user = user;

    if (!user) {

      state.profile = null;
      state.users = [];
      state.tasks = [];

      showLoggedOutScreen();

      return;
    }

    await startApplication();

    updateAvatar();
  }
);


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupEvents();

    // Set version anywhere it exists

    document
      .querySelectorAll(
        "#appVersion, [data-app-version]"
      )
      .forEach(el => {

        el.textContent =
          `Task Manager ${VERSION}`;
      });
  }
);


// ============================================================
// GLOBAL DEBUG ACCESS
// ============================================================

window.TaskManager = {
  state,
  version: VERSION,

  reload: async () => {
    await loadUsers();
    await loadTasks();
    updateDashboard();
  },

  logout: logoutUser
};
