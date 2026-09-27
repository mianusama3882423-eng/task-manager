// ============================================================
// TASK MANAGER
// Secure Email OTP Backend
// Version 1.0.0
// ============================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";
import {
  getAuth
} from "firebase-admin/auth";
import nodemailer from "nodemailer";
import crypto from "crypto";

initializeApp();

const db = getFirestore();
const auth = getAuth();


// ============================================================
// EMAIL SECRETS
// These will NOT be written inside this file.
// They will be stored securely in Firebase Secret Manager.
// ============================================================

const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");


// ============================================================
// SETTINGS
// ============================================================

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;


// ============================================================
// HELPERS
// ============================================================

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}


function generateOTP() {

  return crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();
}


function hashOTP(otp) {

  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}


function createTransporter() {

  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: Number(
      SMTP_PORT.value() || 587
    ),
    secure:
      Number(SMTP_PORT.value() || 587) === 465,

    auth: {
      user: SMTP_USER.value(),
      pass: SMTP_PASS.value()
    }
  });
}


// ============================================================
// SEND OTP
// ============================================================

export const sendRegistrationOTP = onCall(
  {
    region: "asia-south1",

    secrets: [
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS
    ],

    enforceAppCheck: false
  },

  async (request) => {

    const data = request.data || {};

    const name =
      String(data.name || "").trim();

    const email =
      normalizeEmail(data.email);

    const password =
      String(data.password || "");


    if (!name) {

      throw new HttpsError(
        "invalid-argument",
        "Name is required."
      );
    }


    if (!email) {

      throw new HttpsError(
        "invalid-argument",
        "Email is required."
      );
    }


    if (password.length < 6) {

      throw new HttpsError(
        "invalid-argument",
        "Password must contain at least 6 characters."
      );
    }


    // --------------------------------------------------------
    // Check whether email already exists
    // --------------------------------------------------------

    try {

      await auth.getUserByEmail(email);

      throw new HttpsError(
        "already-exists",
        "This email is already registered."
      );

    } catch (error) {

      if (
        error instanceof HttpsError
      ) {
        throw error;
      }

      if (
        error?.code !==
        "auth/user-not-found"
      ) {

        throw new HttpsError(
          "internal",
          "Unable to check this email."
        );
      }
    }


    // --------------------------------------------------------
    // Generate OTP
    // --------------------------------------------------------

    const otp =
      generateOTP();

    const otpHash =
      hashOTP(otp);


    const expiresAt =
      Date.now() +
      OTP_EXPIRY_MINUTES * 60 * 1000;


    // --------------------------------------------------------
    // Save temporary registration
    // Password is encrypted before temporary storage.
    // --------------------------------------------------------

    const registrationRef =
      db.collection(
        "pendingRegistrations"
      ).doc(email);


    const passwordHash =
      crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");


    await registrationRef.set({

      name,

      email,

      passwordHash,

      otpHash,

      expiresAt,

      attempts: 0,

      createdAt:
        FieldValue.serverTimestamp()

    });


    // --------------------------------------------------------
    // Send Email
    // --------------------------------------------------------

    try {

      const transporter =
        createTransporter();


      await transporter.sendMail({

        from:
          `"Task Manager" <${SMTP_USER.value()}>`,

        to: email,

        subject:
          "Task Manager - Your Verification Code",

        text:
          `Your Task Manager verification code is ${otp}. This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:520px;
            margin:auto;
            padding:30px;
            background:#f6f7fb;
          ">

            <div style="
              background:white;
              padding:30px;
              border-radius:16px;
              text-align:center;
            ">

              <h2 style="
                margin:0 0 10px;
                color:#4f46e5;
              ">
                Task Manager
              </h2>

              <p style="
                color:#667085;
                font-size:15px;
              ">
                Your email verification code is:
              </p>

              <div style="
                font-size:34px;
                font-weight:700;
                letter-spacing:8px;
                color:#111827;
                margin:25px 0;
              ">
                ${otp}
              </div>

              <p style="
                color:#667085;
                font-size:13px;
              ">
                This code expires in
                ${OTP_EXPIRY_MINUTES} minutes.
              </p>

              <p style="
                color:#98a2b3;
                font-size:12px;
                margin-top:25px;
              ">
                If you did not request this code,
                you can safely ignore this email.
              </p>

            </div>

          </div>
        `
      });


      return {
        success: true,
        message:
          "Verification code sent to your email."
      };


    } catch (error) {

      console.error(
        "OTP email error:",
        error
      );


      await registrationRef.delete();


      throw new HttpsError(
        "internal",
        "Unable to send verification email."
      );
    }
  }
);


// ============================================================
// VERIFY OTP + CREATE ADMIN
// ============================================================

export const verifyRegistrationOTP = onCall(
  {
    region: "asia-south1"
  },

  async (request) => {

    const data =
      request.data || {};

    const name =
      String(data.name || "").trim();

    const email =
      normalizeEmail(data.email);

    const password =
      String(data.password || "");

    const otp =
      String(data.otp || "").trim();


    if (!name || !email || !password || !otp) {

      throw new HttpsError(
        "invalid-argument",
        "All registration fields are required."
      );
    }


    if (!/^\d{6}$/.test(otp)) {

      throw new HttpsError(
        "invalid-argument",
        "Verification code must contain 6 digits."
      );
    }


    if (password.length < 6) {

      throw new HttpsError(
        "invalid-argument",
        "Password must contain at least 6 characters."
      );
    }


    const registrationRef =
      db.collection(
        "pendingRegistrations"
      ).doc(email);


    const registrationSnap =
      await registrationRef.get();


    if (!registrationSnap.exists) {

      throw new HttpsError(
        "not-found",
        "No pending verification was found for this email."
      );
    }


    const registration =
      registrationSnap.data();


    // --------------------------------------------------------
    // Expiry check
    // --------------------------------------------------------

    if (
      Date.now() >
      Number(registration.expiresAt)
    ) {

      await registrationRef.delete();

      throw new HttpsError(
        "deadline-exceeded",
        "This verification code has expired."
      );
    }


    // --------------------------------------------------------
    // Attempt protection
    // --------------------------------------------------------

    const attempts =
      Number(
        registration.attempts || 0
      );


    if (attempts >= 5) {

      await registrationRef.delete();

      throw new HttpsError(
        "resource-exhausted",
        "Too many incorrect attempts. Please request a new code."
      );
    }


    const submittedHash =
      hashOTP(otp);


    if (
      submittedHash !==
      registration.otpHash
    ) {

      await registrationRef.update({
        attempts: attempts + 1
      });


      throw new HttpsError(
        "invalid-argument",
        "Incorrect verification code."
      );
    }


    // --------------------------------------------------------
    // Create Firebase Authentication account
    // --------------------------------------------------------

    let firebaseUser;

    try {

      firebaseUser =
        await auth.createUser({

          email,

          password,

          displayName: name,

          emailVerified: true

        });

    } catch (error) {

      if (
        error?.code ===
        "auth/email-already-exists"
      ) {

        throw new HttpsError(
          "already-exists",
          "This email is already registered."
        );
      }


      console.error(
        "Auth creation error:",
        error
      );


      throw new HttpsError(
        "internal",
        "Unable to create the account."
      );
    }


    // --------------------------------------------------------
    // Create Admin Firestore Profile
    // --------------------------------------------------------

    await db
      .collection("users")
      .doc(firebaseUser.uid)
      .set({

        uid:
          firebaseUser.uid,

        name,

        email,

        role:
          "admin",

        active:
          true,

        emailVerified:
          true,

        createdAt:
          FieldValue.serverTimestamp()

      });


    // --------------------------------------------------------
    // Delete temporary registration
    // --------------------------------------------------------

    await registrationRef.delete();


    return {

      success: true,

      message:
        "Email verified and admin account created successfully.",

      uid:
        firebaseUser.uid
    };
  }
);
