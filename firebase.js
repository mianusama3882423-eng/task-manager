// ============================================================
// TASK MANAGER
// Firebase Configuration
// Version 1.0.0
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFgxlX2eJH5nFVY7fQXllQG2YNTGe3lIE",
  authDomain: "task-manager-d203c.firebaseapp.com",
  projectId: "task-manager-d203c",
  storageBucket: "task-manager-d203c.firebasestorage.app",
  messagingSenderId: "1018005160470",
  appId: "1:1018005160470:web:32cbbdbc0f7cf65df9eb37"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export {
  app,
  auth,
  db
};
