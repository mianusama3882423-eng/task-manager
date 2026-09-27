// ============================================================
// TASK MANAGER
// Main Application
// Version 1.0.8
// ============================================================

import { app, auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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


// ============================================================
// IMPORTANT: Tell index.html that app.js successfully started
// ============================================================

window.__taskManagerAppStarted = true;
window.dispatchEvent(new Event("taskmanager-ready"));


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
// HELPERS
// ============================================================

function $(id) {
  return document.getElementById(id);
}

function showElement(id, display = "") {
  const el = $(id);
  if (el) {
    el.style.display = display;
  }
}

function hideElement(id) {
  const el = $(id);
  if (el) {
    el.style.display = "none";
  }
}

function setText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value ?? "";
  }
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";

  try {
    if (value?.toDate) {
      return value.toDate().toLocaleString();
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  } catch {
    return "-";
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "0m";

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function showMessage(message, type = "info") {
  console.log(`[Task Manager ${type}]`, message);

  const possibleIds = [
    "message",
    "statusMessage",
    "errorMessage",
    "successMessage"
  ];

  for (const id of possibleIds) {
    const el = $(id);

    if (el) {
      el.textContent = message;
      el.style.display = "block";

      if (type === "error") {
        el.style.color = "#dc2626";
      } else if (type === "success") {
        el.style.color = "#16a34a";
      }

      return;
    }
  }
}

function showStartupError(error) {
  console.error("Task Manager startup error:", error);

  let box = $("startupErrorBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "startupErrorBox";

    box.style.position = "fixed";
    box.style.left = "16px";
    box.style.right = "16px";
    box.style.bottom = "16px";
    box.style.zIndex = "99999";
    box.style.background = "#ffffff";
    box.style.border = "2px solid #ef4444";
    box.style.borderRadius = "14px";
    box.style.padding = "18px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,.20)";
    box.style.fontFamily = "Arial, sans-serif";

    document.body.appendChild(box);
  }

  box.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:#dc2626;margin-bottom:8px">
      Task Manager could not start
    </div>

    <div style="font-size:14px;color:#333;line-height:1.5">
      ${escapeHTML(error?.message || "Unknown application error")}
    </div>

    <button
      onclick="location.reload()"
      style="
        margin-top:12px;
        border:0;
        border-radius:10px;
        padding:10px 16px;
        background:#6c63ff;
        color:white;
        font-weight:600;
        cursor:pointer;
      "
    >
      Reload
    </button>
  `;
}


// ============================================================
// AUTH SCREEN
// ============================================================

function showLoggedOutScreen() {
  hideElement("mainApp");
  showElement("authScreen", "flex");
}


// ============================================================
// MAIN APP
// ============================================================

function showMainApp() {
  hideElement("authScreen");
  showElement("mainApp", "block");
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {
  if (!state.user) {
    throw new Error("No authenticated user found.");
  }

  const ref = doc(db, "users", state.user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(
      "Your account profile was not found in Firestore. Please contact the Super Admin."
    );
  }

  state.profile = {
    id: snap.id,
    ...snap.data()
  };

  console.log("Profile loaded:", state.profile);

  updateUserInterface();
}


// ============================================================
// UPDATE USER INTERFACE
// ============================================================

function updateUserInterface() {
  const name =
    state.profile?.name ||
    state.user?.displayName ||
    state.user?.email ||
    "User";

  const email =
    state.profile?.email ||
    state.user?.email ||
    "";

  const role =
    state.profile?.role ||
    "user";

  const possibleNameIds = [
    "userName",
    "profileName",
    "displayName",
    "currentUserName"
  ];

  for (const id of possibleNameIds) {
    setText(id, name);
  }

  const possibleEmailIds = [
    "userEmail",
    "profileEmail",
    "currentUserEmail"
  ];

  for (const id of possibleEmailIds) {
    setText(id, email);
  }

  const possibleRoleIds = [
    "userRole",
    "profileRole",
    "currentUserRole"
  ];

  for (const id of possibleRoleIds) {
    setText(id, role);
  }
}


// ============================================================
// LOAD USERS
// ============================================================

async function loadUsers() {
  if (!state.profile) return;

  try {
    let snapshot;

    if (
      state.profile.role === "admin" ||
      state.profile.role === "superadmin"
    ) {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student")
      );

      snapshot = await getDocs(q);
    } else {
      state.users = [];
      return;
    }

    state.users = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    console.log("Users loaded:", state.users.length);

    populateTaskUsers();
    renderUsers();
    renderSuperAdminUsers();

  } catch (error) {
    console.error("loadUsers error:", error);
    throw error;
  }
}


// ============================================================
// LOAD TASKS
// ============================================================

async function loadTasks() {
  if (!state.profile) return;

  try {
    let snapshot;

    if (state.profile.role === "student") {

      const q = query(
        collection(db, "tasks"),
        where("assignedTo", "==", state.user.uid)
      );

      snapshot = await getDocs(q);

    } else {

      try {

        const q = query(
          collection(db, "tasks"),
          orderBy("assignedAt", "desc")
        );

        snapshot = await getDocs(q);

      } catch (indexError) {

        console.warn(
          "Ordered task query failed. Using fallback query.",
          indexError
        );

        const q = query(collection(db, "tasks"));

        snapshot = await getDocs(q);
      }
    }

    state.tasks = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    state.tasks.sort((a, b) => {
      const aTime =
        a.assignedAt?.toMillis?.() ||
        new Date(a.assignedAt || 0).getTime() ||
        0;

      const bTime =
        b.assignedAt?.toMillis?.() ||
        new Date(b.assignedAt || 0).getTime() ||
        0;

      return bTime - aTime;
    });

    console.log("Tasks loaded:", state.tasks.length);

    renderTasks();
    renderProgress();

  } catch (error) {
    console.error("loadTasks error:", error);
    throw error;
  }
}


// ============================================================
// POPULATE TASK USER DROPDOWN
// ============================================================

function populateTaskUsers() {
  const possibleIds = [
    "taskAssignedTo",
    "assignedTo",
    "studentSelect",
    "taskStudent"
  ];

  let select = null;

  for (const id of possibleIds) {
    const element = $(id);

    if (
      element &&
      element.tagName &&
      element.tagName.toLowerCase() === "select"
    ) {
      select = element;
      break;
    }
  }

  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Select Student</option>
  `;

  for (const student of state.users) {
    const option = document.createElement("option");

    option.value = student.id;

    option.textContent =
      student.name ||
      student.email ||
      "Student";

    select.appendChild(option);
  }

  if (currentValue) {
    select.value = currentValue;
  }
}


// ============================================================
// RENDER USERS
// ============================================================

function renderUsers() {
  const possibleIds = [
    "usersList",
    "studentsList",
    "userList"
  ];

  let container = null;

  for (const id of possibleIds) {
    if ($(id)) {
      container = $(id);
      break;
    }
  }

  if (!container) return;

  if (!state.users.length) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center">
        No students found.
      </div>
    `;
    return;
  }

  container.innerHTML = state.users.map(student => {

    const studentTasks = state.tasks.filter(
      task => task.assignedTo === student.id
    );

    const completed = studentTasks.filter(
      task => task.status === "completed"
    ).length;

    const total = studentTasks.length;

    const progress =
      total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    return `
      <div
        class="user-card"
        data-student-id="${escapeHTML(student.id)}"
        style="cursor:pointer"
      >

        <div>
          <strong>
            ${escapeHTML(student.name || "Student")}
          </strong>

          <div>
            ${escapeHTML(student.email || "")}
          </div>
        </div>

        <div>
          ${progress}% Progress
        </div>

      </div>
    `;

  }).join("");

  container.querySelectorAll("[data-student-id]").forEach(card => {

    card.addEventListener("click", () => {

      state.selectedStudentId =
        card.dataset.studentId;

      renderProgress();

      showPage("progress");
    });

  });
}


// ============================================================
// SUPER ADMIN USERS
// ============================================================

function renderSuperAdminUsers() {

  if (state.profile?.role !== "superadmin") {
    return;
  }

  const container =
    $("superAdminUsers") ||
    $("adminUsersList") ||
    $("allUsersList");

  if (!container) return;

  const admins = state.users.filter(
    user => user.role === "admin"
  );

  if (!admins.length) {
    container.innerHTML = `
      <div style="padding:20px">
        No admin data loaded.
      </div>
    `;

    return;
  }

  container.innerHTML = admins.map(admin => {

    const students = state.users.filter(
      student =>
        student.role === "student" &&
        student.createdBy === admin.id
    );

    return `
      <div class="admin-card">

        <h3>
          ${escapeHTML(admin.name || "Admin")}
        </h3>

        <div>
          ${escapeHTML(admin.email || "")}
        </div>

        <div>
          Students created: ${students.length}
        </div>

      </div>
    `;

  }).join("");
}


// ============================================================
// RENDER TASKS
// ============================================================

function renderTasks() {

  const container =
    $("tasksList") ||
    $("taskList") ||
    $("studentTasks");

  if (!container) return;

  if (!state.tasks.length) {

    container.innerHTML = `
      <div style="padding:20px;text-align:center">
        No tasks found.
      </div>
    `;

    return;
  }

  container.innerHTML = state.tasks.map(task => {

    const status =
      task.status || "pending";

    const assignedBy =
      task.assignedByName ||
      "Admin";

    return `
      <div class="task-card">

        <div>
          <h3>
            ${escapeHTML(task.title || "Untitled Task")}
          </h3>

          <p>
            ${escapeHTML(task.description || "")}
          </p>

          <p>
            <strong>Assigned by:</strong>
            ${escapeHTML(assignedBy)}
          </p>

          <p>
            <strong>Status:</strong>
            ${escapeHTML(status)}
          </p>

          <p>
            <strong>Due:</strong>
            ${escapeHTML(formatDate(task.dueDate))}
          </p>

        </div>

        ${
          state.profile?.role === "student"
            ? `
              <div style="margin-top:10px">

                ${
                  status === "pending"
                    ? `
                      <button
                        class="task-action"
                        data-task-id="${escapeHTML(task.id)}"
                        data-action="accept"
                      >
                        Accept
                      </button>
                    `
                    : ""
                }

                ${
                  status === "accepted"
                    ? `
                      <button
                        class="task-action"
                        data-task-id="${escapeHTML(task.id)}"
                        data-action="start"
                      >
                        Start Task
                      </button>
                    `
                    : ""
                }

                ${
                  status === "in_progress"
                    ? `
                      <button
                        class="task-action"
                        data-task-id="${escapeHTML(task.id)}"
                        data-action="complete"
                      >
                        Complete
                      </button>
                    `
                    : ""
                }

              </div>
            `
            : ""
        }

      </div>
    `;

  }).join("");

  container
    .querySelectorAll(".task-action")
    .forEach(button => {

      button.addEventListener("click", async () => {

        const taskId =
          button.dataset.taskId;

        const action =
          button.dataset.action;

        await updateTaskStatus(
          taskId,
          action
        );

      });

    });
}


// ============================================================
// TASK STATUS
// ============================================================

async function updateTaskStatus(taskId, action) {

  const task =
    state.tasks.find(item => item.id === taskId);

  if (!task) return;

  const now = Date.now();

  const updates = {};

  if (action === "accept") {

    updates.status = "accepted";
    updates.acceptedAt = serverTimestamp();

  }

  if (action === "start") {

    updates.status = "in_progress";
    updates.startedAt = serverTimestamp();

  }

  if (action === "complete") {

    updates.status = "completed";
    updates.completedAt = serverTimestamp();

    if (task.startedAt) {

      let startTime = 0;

      if (task.startedAt.toMillis) {
        startTime = task.startedAt.toMillis();
      } else {
        startTime =
          new Date(task.startedAt).getTime();
      }

      if (startTime) {
        updates.durationMs =
          Math.max(0, now - startTime);
      }
    }
  }

  if (!Object.keys(updates).length) {
    return;
  }

  try {

    await updateDoc(
      doc(db, "tasks", taskId),
      updates
    );

    await loadTasks();

    showMessage(
      "Task updated successfully.",
      "success"
    );

  } catch (error) {

    console.error(
      "updateTaskStatus error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );
  }
}


// ============================================================
// RENDER PROGRESS
// ============================================================

function renderProgress() {

  const container =
    $("progressContent") ||
    $("progressList") ||
    $("studentProgress");

  if (!container) return;

  let tasks = state.tasks;

  if (state.selectedStudentId) {

    tasks = tasks.filter(
      task =>
        task.assignedTo ===
        state.selectedStudentId
    );
  }

  const total = tasks.length;

  const completed = tasks.filter(
    task => task.status === "completed"
  ).length;

  const pending = tasks.filter(
    task => task.status === "pending"
  ).length;

  const inProgress = tasks.filter(
    task => task.status === "in_progress"
  ).length;

  const progress =
    total > 0
      ? Math.round(
          (completed / total) * 100
        )
      : 0;

  container.innerHTML = `
    <div class="progress-summary">

      <h3>
        Progress
      </h3>

      <p>
        Total Tasks: ${total}
      </p>

      <p>
        Completed: ${completed}
      </p>

      <p>
        In Progress: ${inProgress}
      </p>

      <p>
        Pending: ${pending}
      </p>

      <p>
        Overall Progress: ${progress}%
      </p>

    </div>
  `;
}


// ============================================================
// CREATE STUDENT
// ============================================================

async function createStudent(
  name,
  email,
  password
) {

  if (
    !name ||
    !email ||
    !password
  ) {
    throw new Error(
      "Name, email and password are required."
    );
  }

  if (
    state.profile?.role !== "admin" &&
    state.profile?.role !== "superadmin"
  ) {
    throw new Error(
      "Only an Admin or Super Admin can create students."
    );
  }

  /*
   * Important:
   * Creating another Firebase Auth account from the
   * currently logged-in browser would sign the current
   * admin out.
   *
   * Therefore this function intentionally keeps the
   * Firestore/profile logic separate.
   */

  throw new Error(
    "Student account creation requires the secure secondary Firebase Auth setup."
  );
}


// ============================================================
// CREATE TASK
// ============================================================

async function createTask(data) {

  if (!state.user || !state.profile) {
    throw new Error("You are not logged in.");
  }

  if (
    state.profile.role !== "admin" &&
    state.profile.role !== "superadmin"
  ) {
    throw new Error(
      "Only Admin or Super Admin can assign tasks."
    );
  }

  const student =
    state.users.find(
      user => user.id === data.assignedTo
    );

  if (!student) {
    throw new Error(
      "Please select a valid student."
    );
  }

  const taskData = {

    title:
      data.title?.trim() ||
      "Untitled Task",

    description:
      data.description?.trim() ||
      "",

    assignedTo:
      student.id,

    assignedToName:
      student.name ||
      student.email ||
      "Student",

    assignedBy:
      state.user.uid,

    assignedByName:
      state.profile.name ||
      state.user.displayName ||
      "Admin",

    status:
      "pending",

    dueDate:
      data.dueDate || "",

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
  };

  await addDoc(
    collection(db, "tasks"),
    taskData
  );

  await loadTasks();

  showMessage(
    "Task assigned successfully.",
    "success"
  );
}


// ============================================================
// SHOW PAGE
// ============================================================

function showPage(page) {

  state.currentPage = page;

  console.log(
    "Showing page:",
    page
  );

  document
    .querySelectorAll("[data-page]")
    .forEach(element => {

      const target =
        element.dataset.page;

      element.style.display =
        target === page
          ? ""
          : "none";
    });

  const pageIds = {
    dashboard: [
      "dashboardPage",
      "homePage"
    ],

    users: [
      "usersPage"
    ],

    tasks: [
      "tasksPage"
    ],

    progress: [
      "progressPage"
    ]
  };

  Object.entries(pageIds)
    .forEach(([name, ids]) => {

      ids.forEach(id => {

        const el = $(id);

        if (!el) return;

        el.style.display =
          name === page
            ? ""
            : "none";

      });

    });
}


// ============================================================
// REGISTER ADMIN
// ============================================================

async function registerAdmin(
  name,
  email,
  password
) {

  if (
    !name ||
    !email ||
    !password
  ) {
    throw new Error(
      "Please fill all required fields."
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  await setDoc(
    doc(
      db,
      "users",
      credential.user.uid
    ),
    {

      uid:
        credential.user.uid,

      name:
        name.trim(),

      email:
        email.trim().toLowerCase(),

      role:
        "admin",

      active:
        true,

      createdAt:
        serverTimestamp()

    }
  );

  showMessage(
    "Admin account created successfully.",
    "success"
  );
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(
  email,
  password
) {

  if (!email || !password) {

    throw new Error(
      "Email and password are required."
    );

  }

  await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );

    showMessage(
      error.message,
      "error"
    );
  }
}


// ============================================================
// EVENT SETUP
// ============================================================

function setupEvents() {

  console.log(
    "Setting up Task Manager events..."
  );


  // ----------------------------------------------------------
  // Login form
  // ----------------------------------------------------------

  const loginForm =
    $("loginForm");

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          const email =
            $("loginEmail")?.value?.trim() ||
            $("email")?.value?.trim() ||
            "";

          const password =
            $("loginPassword")?.value ||
            $("password")?.value ||
            "";

          await loginUser(
            email,
            password
          );

        } catch (error) {

          console.error(
            "Login error:",
            error
          );

          showMessage(
            error.message,
            "error"
          );
        }

      }
    );
  }


  // ----------------------------------------------------------
  // Register form
  // ----------------------------------------------------------

  const registerForm =
    $("registerForm");

  if (registerForm) {

    registerForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          const name =
            $("registerName")?.value?.trim() ||
            $("adminName")?.value?.trim() ||
            "";

          const email =
            $("registerEmail")?.value?.trim() ||
            "";

          const password =
            $("registerPassword")?.value ||
            "";

          const confirmPassword =
            $("registerConfirmPassword")?.value ||
            "";

          if (
            confirmPassword &&
            password !== confirmPassword
          ) {

            throw new Error(
              "Passwords do not match."
            );

          }

          await registerAdmin(
            name,
            email,
            password
          );

        } catch (error) {

          console.error(
            "Register error:",
            error
          );

          showMessage(
            error.message,
            "error"
          );
        }

      }
    );
  }


  // ----------------------------------------------------------
  // Logout buttons
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      '[data-action="logout"], #logoutBtn, #logoutButton'
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        logoutUser
      );

    });


  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------

  document
    .querySelectorAll("[data-page-target]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.pageTarget;

          if (page) {
            showPage(page);
          }

        }
      );

    });


  // ----------------------------------------------------------
  // Direct page buttons
  // ----------------------------------------------------------

  const dashboardButton =
    $("dashboardBtn");

  if (dashboardButton) {

    dashboardButton.addEventListener(
      "click",
      () => showPage("dashboard")
    );

  }


  const usersButton =
    $("usersBtn");

  if (usersButton) {

    usersButton.addEventListener(
      "click",
      () => showPage("users")
    );

  }


  const tasksButton =
    $("tasksBtn");

  if (tasksButton) {

    tasksButton.addEventListener(
      "click",
      () => showPage("tasks")
    );

  }


  const progressButton =
    $("progressBtn");

  if (progressButton) {

    progressButton.addEventListener(
      "click",
      () => showPage("progress")
    );

  }


  // ----------------------------------------------------------
  // Create Task form
  // ----------------------------------------------------------

  const taskForm =
    $("taskForm");

  if (taskForm) {

    taskForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          const title =
            $("taskTitle")?.value ||
            "";

          const description =
            $("taskDescription")?.value ||
            "";

          const assignedTo =
            $("taskAssignedTo")?.value ||
            $("assignedTo")?.value ||
            "";

          const dueDate =
            $("taskDueDate")?.value ||
            "";

          await createTask({
            title,
            description,
            assignedTo,
            dueDate
          });

          taskForm.reset();

        } catch (error) {

          console.error(
            "Create task error:",
            error
          );

          showMessage(
            error.message,
            "error"
          );
        }

      }
    );
  }


  // ----------------------------------------------------------
  // Global logout by class
  // ----------------------------------------------------------

  document
    .querySelectorAll(".logout")
    .forEach(button => {

      button.addEventListener(
        "click",
        logoutUser
      );

    });


  console.log(
    "Task Manager events ready."
  );
}


// ============================================================
// START APPLICATION
// ============================================================

async function startApplication() {

  try {

    console.log(
      "Starting Task Manager..."
    );

    if (!state.user) {
      throw new Error(
        "Authentication state is missing."
      );
    }

    await loadProfile();

    showMainApp();

    await loadUsers();

    await loadTasks();

    renderUsers();

    renderTasks();

    renderProgress();

    renderSuperAdminUsers();

    showPage(
      state.profile?.role === "student"
        ? "tasks"
        : "dashboard"
    );

    console.log(
      "Task Manager started successfully."
    );

  } catch (error) {

    console.error(
      "Application startup failed:",
      error
    );

    showStartupError(error);
  }
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    try {

      console.log(
        "Auth state changed:",
        user?.email || "Logged out"
      );

      state.user = user;

      if (!user) {

        state.profile = null;
        state.users = [];
        state.tasks = [];

        showLoggedOutScreen();

        return;
      }

      await startApplication();

    } catch (error) {

      console.error(
        "Auth listener error:",
        error
      );

      showStartupError(error);
    }

  }
);


// ============================================================
// DOM READY
// ============================================================

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    setupEvents,
    { once: true }
  );

} else {

  setupEvents();

}


// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

window.addEventListener(
  "error",
  event => {

    console.error(
      "Global error:",
      event.error || event.message
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

  }
);


// ============================================================
// DEBUG ACCESS
// ============================================================

window.TaskManager = {

  state,

  login: loginUser,

  logout: logoutUser,

  reloadUsers: loadUsers,

  reloadTasks: loadTasks,

  showPage

};


console.log(
  "Task Manager v1.0.8 app.js loaded successfully."
);
