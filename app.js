/* =========================================================
   FIREBASE CONFIG
   Replace this with YOUR project's config from:
   Firebase Console → Project settings → General → Your apps
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyAstnlHgJ3nzvKaBS1cWHSf2zOVbgmWwpM",
  authDomain: "workimmersion.firebaseapp.com",
  databaseURL: "https://workimmersion-default-rtdb.firebaseio.com",
  projectId: "workimmersion",
  storageBucket: "workimmersion.firebasestorage.app",
  messagingSenderId: "415875212716",
  appId: "1:415875212716:web:5d80f03a67892f43928609",
  measurementId: "G-3B18VTED92"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* =========================================================
   OPTIONAL: restrict sign-in to your school's Gmail domain
   e.g. only allow accounts ending in @yourschool.edu.ph
   Leave SCHOOL_DOMAIN as "" to allow any Gmail account.
   ========================================================= */
const SCHOOL_DOMAIN = ""; // e.g. "yourschool.edu.ph"

/* ---------- Screen helpers ---------- */
const screens = {
  login: document.getElementById("screen-login"),
  consent: document.getElementById("screen-consent"),
  profile: document.getElementById("screen-profile"),
  done: document.getElementById("screen-done")
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ---------- Element refs ---------- */
const btnGoogleSignIn = document.getElementById("btn-google-signin");
const loginError = document.getElementById("login-error");

const consentCheckbox = document.getElementById("consent-checkbox");
const btnConsentContinue = document.getElementById("btn-consent-continue");

const profileForm = document.getElementById("profile-form");
const profileGreeting = document.getElementById("profile-greeting");
const profileError = document.getElementById("profile-error");

const doneName = document.getElementById("done-name");
const btnSignOut = document.getElementById("btn-signout");

let currentUser = null;

/* =========================================================
   STEP 1: Google sign-in
   ========================================================= */
btnGoogleSignIn.addEventListener("click", async () => {
  loginError.hidden = true;
  const provider = new firebase.auth.GoogleAuthProvider();
  if (SCHOOL_DOMAIN) {
    provider.setCustomParameters({ hd: SCHOOL_DOMAIN });
  }

  try {
    const result = await auth.signInWithPopup(provider);
    const email = result.user.email || "";

    if (SCHOOL_DOMAIN && !email.endsWith("@" + SCHOOL_DOMAIN)) {
      await auth.signOut();
      loginError.textContent = `Please sign in with your @${SCHOOL_DOMAIN} account.`;
      loginError.hidden = false;
    }
    // onAuthStateChanged below handles routing after successful sign-in
  } catch (err) {
    loginError.textContent = "Sign-in failed: " + err.message;
    loginError.hidden = false;
  }
});

/* =========================================================
   Auth state watcher — runs whenever login state changes
   ========================================================= */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    currentUser = null;
    showScreen("login");
    return;
  }

  currentUser = user;
  const userDocRef = db.collection("users").doc(user.uid);
  const userDoc = await userDocRef.get();
  const data = userDoc.exists ? userDoc.data() : null;

  if (!data || !data.consentGiven) {
    showScreen("consent");
  } else if (!data.profileComplete) {
    profileGreeting.textContent = `Signed in as ${user.email}. This is saved once and used for every attendance record.`;
    showScreen("profile");
  } else {
    doneName.textContent = data.name || user.displayName || "";
    showScreen("done");
  }
});

/* =========================================================
   STEP 2: Consent
   ========================================================= */
consentCheckbox.addEventListener("change", () => {
  btnConsentContinue.disabled = !consentCheckbox.checked;
});

btnConsentContinue.addEventListener("click", async () => {
  if (!currentUser) return;
  btnConsentContinue.disabled = true;
  btnConsentContinue.textContent = "Saving...";

  try {
    await db.collection("users").doc(currentUser.uid).set(
      {
        email: currentUser.email,
        consentGiven: true,
        consentTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        profileComplete: false
      },
      { merge: true }
    );
    profileGreeting.textContent = `Signed in as ${currentUser.email}. This is saved once and used for every attendance record.`;
    showScreen("profile");
  } catch (err) {
    alert("Could not save consent: " + err.message);
    btnConsentContinue.disabled = false;
    btnConsentContinue.textContent = "Continue";
  }
});

/* =========================================================
   STEP 3: Profile form
   ========================================================= */
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileError.hidden = true;

  const name = document.getElementById("field-name").value.trim();
  const age = Number(document.getElementById("field-age").value);
  const section = document.getElementById("field-section").value.trim();
  const workplace = document.getElementById("field-workplace").value.trim();

  if (!name || !age || !section || !workplace) {
    profileError.textContent = "Please fill in every field.";
    profileError.hidden = false;
    return;
  }

  const submitBtn = profileForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    await db.collection("users").doc(currentUser.uid).set(
      {
        name,
        age,
        section,
        assignedWorkplaceLabel: workplace,
        // The exact GPS coordinates for this workplace get added separately
        // by the teacher/admin in a later step (geofencing setup).
        profileComplete: true,
        profileUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    doneName.textContent = name;
    showScreen("done");
  } catch (err) {
    profileError.textContent = "Could not save profile: " + err.message;
    profileError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save and continue";
  }
});

/* =========================================================
   Sign out
   ========================================================= */
btnSignOut.addEventListener("click", () => {
  auth.signOut();
});
