// script.js - FINAL VERSION (Fixed Google Maps)

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyAlBj0rrm8LS1fyMNFdKkcOefIZIKh9NNQ",
    authDomain: "asep-ee520.firebaseapp.com",
    projectId: "asep-ee520",
    storageBucket: "asep-ee520.firebasestorage.app",
    messagingSenderId: "735140319868",
    appId: "1:735140319868:web:60166c791ba5348ac12ff9",
    measurementId: "G-FL55QPHH8B"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// FORCE PERSISTENCE: Keeps you logged in
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let currentUser = null;
let globalReminders = []; // Store reminders here so they work on ANY page

// ==========================================
// 2. ALARM SYSTEM (Audio + Visual Modal)
// ==========================================
const alarmSound = new Audio('reminder.MPEG'); // Ensure file is in folder
alarmSound.loop = true; 

// AUTOMATICALLY CREATE THE POPUP HTML (Runs on every page)
document.addEventListener("DOMContentLoaded", () => {
    const modalHTML = `
    <div id="alarmModal" class="modal">
      <div class="modal-content">
        <h2>⏰ It's Medicine Time!</h2>
        <p style="font-size: 0.95rem; margin-top: 10px; color:#666;">Please take your:</p>
        <h3 id="alarmPillName">Medicine</h3>
        <button class="confirm-taken-btn" onclick="confirmTaken()">✅ I've Taken It</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
});

// TRIGGER ALARM
function triggerAlarm(medicineName) {
    const modal = document.getElementById("alarmModal");
    const nameText = document.getElementById("alarmPillName");
    
    if(nameText) nameText.textContent = medicineName;
    if(modal) modal.style.display = "block";
    
    alarmSound.play().catch(e => console.log("Audio waiting for interaction:", e));
}

// STOP ALARM
window.confirmTaken = function() {
    const modal = document.getElementById("alarmModal");
    if(modal) modal.style.display = "none";
    alarmSound.pause();
    alarmSound.currentTime = 0;
}

// ==========================================
// 3. AUTH STATE LISTENER & DATA LOADER
// ==========================================
auth.onAuthStateChanged(user => {
    const userDisplay = document.getElementById("userDisplay");
    const authBtn = document.getElementById("authBtn");
    const authCheck = document.getElementById("authCheck");

    if (user) {
        currentUser = user;
        if(userDisplay) userDisplay.textContent = user.email.split("@")[0];
        if(authBtn) {
            authBtn.textContent = "Logout";
            authBtn.onclick = logoutUser;
            authBtn.classList.add("mc-btn-primary");
        }
        if(authCheck) authCheck.style.display = "none";

        // START THE ALARM SYSTEM
        subscribeToReminders();
        startAlarmClock();

        // Load specific page data
        if(document.getElementById("vaccinationList")) loadAllRecords();
        if(document.getElementById("favoritesList")) loadHospitals();

    } else {
        currentUser = null;
        globalReminders = [];
        if(userDisplay) userDisplay.textContent = "Guest";
        if(authBtn) {
            authBtn.textContent = "Login";
            authBtn.onclick = () => window.location.href = "login.html";
            authBtn.classList.remove("mc-btn-primary");
        }
        if(authCheck) {
            authCheck.innerHTML = `<div class="mc-auth-alert">⚠️ Please <a href="login.html">login</a> to view data.</div>`;
            authCheck.style.display = "block";
        }
    }
});

// ==========================================
// 4. INTELLIGENT CLOCK
// ==========================================
function subscribeToReminders() {
    db.collection("reminders").where("userId", "==", currentUser.uid).onSnapshot(snap => {
        globalReminders = [];
        const uiList = document.getElementById("remindersList");
        if(uiList) uiList.innerHTML = "";

        snap.forEach(doc => {
            const r = doc.data();
            globalReminders.push({ id: doc.id, ...r, rangAt: null });

            if(uiList) {
                uiList.innerHTML += `
                <div class="mc-reminder-item">
                    <div class="mc-reminder-info">
                        <h4>💊 ${r.medicineName} <small>(${r.dosage})</small></h4>
                        <p style="color:#ff4b5c; font-weight:bold;">⏰ ${r.time}</p>
                        <p>👤 ${r.familyMember}</p>
                    </div>
                    <button class="mc-btn-small mc-btn-delete" onclick="deleteDoc('reminders', '${doc.id}')">Delete</button>
                </div>`;
            }
        });
    });
}

function startAlarmClock() {
    setInterval(() => {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); 
        
        globalReminders.forEach(rem => {
            if (rem.time === currentTime && rem.rangAt !== currentTime) {
                console.log("ALARM:", rem.medicineName);
                triggerAlarm(rem.medicineName);
                rem.rangAt = currentTime; 
            }
        });
    }, 2000);
}

// ==========================================
// 5. LOGIN / SIGNUP / LOGOUT
// ==========================================
window.loginUser = function() {
    const e = document.getElementById("loginEmail").value;
    const p = document.getElementById("loginPassword").value;
    if(!e || !p) return alert("Fill all fields");
    auth.signInWithEmailAndPassword(e, p)
        .then(() => window.location.href = "index.html")
        .catch(err => alert(err.message));
}

window.signupUser = function() {
    const e = document.getElementById("signupEmail").value;
    const p = document.getElementById("signupPassword").value;
    const n = document.getElementById("signupName").value;
    if(!e || !p || !n) return alert("Fill all fields");
    auth.createUserWithEmailAndPassword(e, p)
        .then(cred => db.collection("users").doc(cred.user.uid).set({name:n, email:e}))
        .then(() => { alert("Created!"); window.location.href = "index.html"; })
        .catch(err => alert(err.message));
}

function logoutUser() {
    if(confirm("Logout?")) auth.signOut().then(() => window.location.href = "index.html");
}

// ==========================================
// 6. FEATURES (Saving Data)
// ==========================================
const remForm = document.getElementById("addReminderForm");
if(remForm) {
    remForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if(!currentUser) return alert("Please Login");
        db.collection("reminders").add({
            userId: currentUser.uid,
            medicineName: document.getElementById("medicineName").value,
            dosage: document.getElementById("dosage").value,
            time: document.getElementById("time").value,
            familyMember: document.getElementById("familyMember").value,
            createdAt: new Date().toISOString()
        }).then(() => { alert("Saved!"); remForm.reset(); });
    });
}

const recordForms = [
    { id: "addVaccinationForm", type: "vaccination", fields: ["vaccineName", "vaccineDate", "familyMember"] },
    { id: "addCheckupForm", type: "checkup", fields: ["doctorName", "checkupDate", "checkupNotes"] },
    { id: "addMoodForm", type: "mood", fields: ["moodDate", "moodLevel", "moodNotes"] }
];
recordForms.forEach(config => {
    const form = document.getElementById(config.id);
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!currentUser) return alert("Please Login");
            let data = { userId: currentUser.uid, type: config.type, createdAt: new Date().toISOString() };
            config.fields.forEach(fieldId => {
                const input = document.getElementById(fieldId);
                if(input) data[fieldId] = input.value;
            });
            db.collection("records").add(data).then(() => { alert("Saved!"); form.reset(); });
        });
    }
});

function loadAllRecords() {
    if(!currentUser) return;
    db.collection("records").where("userId", "==", currentUser.uid).onSnapshot(snap => {
        const vList = document.getElementById("vaccinationList");
        const cList = document.getElementById("checkupList");
        const mList = document.getElementById("moodList");
        if(vList) vList.innerHTML = ""; if(cList) cList.innerHTML = ""; if(mList) mList.innerHTML = "";

        snap.forEach(doc => {
            const r = doc.data();
            const html = `
            <div class="mc-record-item">
                <div class="mc-record-info">
                    <h4>${r.vaccineName || r.doctorName || r.moodLevel}</h4>
                    <p>📅 ${r.vaccineDate || r.checkupDate || r.moodDate}</p>
                    <p>${r.familyMember || r.checkupNotes || r.moodNotes || ''}</p>
                </div>
                <button class="mc-btn-small mc-btn-delete" onclick="deleteDoc('records', '${doc.id}')">Delete</button>
            </div>`;
            if (r.type === 'vaccination' && vList) vList.innerHTML += html;
            if (r.type === 'checkup' && cList) cList.innerHTML += html;
            if (r.type === 'mood' && mList) mList.innerHTML += html;
        });
    });
}

// ==========================================
// 7. FIXED GOOGLE MAPS LOGIC
// ==========================================
window.searchOnMaps = function() {
    const cityInput = document.getElementById('cityInput');
    let query = "hospitals near me"; // Default search
    
    // If user typed a city, change query to "hospitals near [city]"
    if (cityInput && cityInput.value.trim() !== "") {
        query = `hospitals near ${cityInput.value.trim()}`;
    }
    
    // Open Google Maps in new tab
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
}

const favForm = document.getElementById('addHospitalForm');
if(favForm) {
    favForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if(!currentUser) return alert("Please Login");
        db.collection("favorites").add({
            userId: currentUser.uid,
            name: document.getElementById('hospitalName').value,
            location: document.getElementById('hospitalLocation').value,
            phone: document.getElementById('hospitalPhone').value,
            createdAt: new Date()
        }).then(() => { alert("Saved!"); favForm.reset(); });
    });
}
function loadHospitals() {
    const list = document.getElementById("favoritesList");
    if(!list) return;
    db.collection("favorites").where("userId", "==", currentUser.uid).onSnapshot(snap => {
        list.innerHTML = "";
        snap.forEach(doc => {
            const h = doc.data();
            list.innerHTML += `<div class="mc-hospital-card"><div><h4>🏥 ${h.name}</h4><p>${h.location}</p></div><button class="mc-btn-small mc-btn-delete" onclick="deleteDoc('favorites', '${doc.id}')">Delete</button></div>`;
        });
    });
}
window.deleteDoc = function(col, id) {
    if(confirm("Delete this?")) db.collection(col).doc(id).delete();
}