document.addEventListener('DOMContentLoaded', () => {

    // Firebase imports
    const { initializeApp } = require("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const { getDatabase, ref, set, push, onValue, get, update } = require("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } = require("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

    // Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyDVaA2Q7w5HxX6ijN574ci2ROlk22t7-YU",
      authDomain: "oodi-fad98.firebaseapp.com",
      databaseURL: "https://oodi-fad98-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "oodi-fad98",
      storageBucket: "oodi-fad98.appspot.com",
      messagingSenderId: "717908884541",
      appId: "1:717908884541:web:9db1e88546c583db5d7e54",
      measurementId: "G-LKB7K7T1FH"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const auth = getAuth(app);

    // --- GLOBAL STATE ---
    let currentUser = null;
    let viewingUid = null; // For admin to view other users' data
    const adminEmail = "rahimboyislombek@gmail.com";

    // --- DOM ELEMENTS ---
    const authSection = document.getElementById('authSection');
    const mainApp = document.getElementById('mainApp');
    const adminControls = document.getElementById('adminControls');
    const adminUserSelect = document.getElementById('adminUserSelect');
    const adminNav = document.getElementById('adminNav');

    // --- ADMIN FUNCTIONS ---

    const loadUsersForAdminDropdown = async () => {
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            adminUserSelect.innerHTML = '<option value="">View Own Data</option>';
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const user = childSnapshot.val();
                    const uid = childSnapshot.key;
                    if (uid === currentUser.uid) return;
                    const option = document.createElement('option');
                    option.value = uid;
                    option.textContent = user.profile?.email || uid;
                    adminUserSelect.appendChild(option);
                });
            }
        });
    };

    adminUserSelect.addEventListener('change', () => {
        viewingUid = adminUserSelect.value || currentUser.uid;
        const activePage = document.querySelector('.page[style*="block"]');
        showPage(activePage ? activePage.id : 'dashboardPage');
    });

    const loadAdminUserList = async () => {
        const listEl = document.getElementById('adminUserManagementList');
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            listEl.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const uid = childSnapshot.key;
                    if (uid === currentUser.uid) return;

                    const user = childSnapshot.val();
                    const email = user.profile?.email || 'N/A';
                    const isDisabled = user.profile?.disabled || false;

                    const itemEl = document.createElement('div');
                    itemEl.className = 'list-item';
                    itemEl.innerHTML = `
                        <span>${email}</span>
                        <button class="btn ${isDisabled ? 'primary-btn' : 'danger-btn'}" style="width: auto;" onclick="toggleUserSuspension('${uid}', ${!isDisabled})">
                            ${isDisabled ? 'Enable' : 'Suspend'}
                        </button>
                    `;
                    listEl.appendChild(itemEl);
                });
            }
        });
    };

    window.toggleUserSuspension = async (uid, shouldDisable) => {
        const userProfileRef = ref(db, `users/${uid}/profile`);
        try {
            await update(userProfileRef, { disabled: shouldDisable });
            alert(`User account has been ${shouldDisable ? 'suspended' : 'enabled'}.`);
        } catch (error) {
            alert(`Operation failed: ${error.message}`);
        }
    };

    // --- AUTHENTICATION ---

    const loginUser = async (email, password) => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userProfileRef = ref(db, `users/${cred.user.uid}/profile`);
            const snapshot = await get(userProfileRef);
            if (snapshot.exists() && snapshot.val().disabled) {
                await signOut(auth);
                alert("This account has been suspended by the administrator.");
            }
        } catch (error) { alert(`Login failed: ${error.message}`); }
    };

    const registerUser = async (email, password) => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await set(ref(db, `users/${cred.user.uid}/profile`), { email, disabled: false });
            alert("Registration successful!");
        } catch (error) { alert(`Registration failed: ${error.message}`); }
    };

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loginUser(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        registerUser(document.getElementById('registerEmail').value, document.getElementById('registerPassword').value);
    });

    window.logoutUser = () => signOut(auth);

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const reauthSection = document.getElementById('reauthSection');
        const currentPassword = document.getElementById('currentPassword').value;

        if (reauthSection.style.display === 'block' && !currentPassword) {
            return alert('Please enter your current password to re-authenticate.');
        }

        if (!newPassword || newPassword.length < 6) return alert('New password must be at least 6 characters.');

        try {
            if (reauthSection.style.display === 'block') {
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
            }

            await updatePassword(currentUser, newPassword);
            alert('Password updated successfully!');
            closeModal('changePasswordModal');

        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                reauthSection.style.display = 'block';
                alert('This is a sensitive operation. Please enter your current password to confirm.');
            } else {
                alert(`An error occurred: ${error.message}`);
            }
        }
    });
    
    // --- AUTH STATE & NAVIGATION ---

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            viewingUid = user.uid;
            authSection.style.display = 'none';
            mainApp.style.display = 'block';

            if (user.email === adminEmail) {
                adminControls.style.display = 'block';
                adminNav.style.display = 'flex';
                loadUsersForAdminDropdown();
            } else {
                adminControls.style.display = 'none';
                adminNav.style.display = 'none';
            }
            showPage('dashboardPage');
        } else {
            currentUser = null;
            viewingUid = null;
            authSection.style.display = 'flex';
            mainApp.style.display = 'none';
        }
    });

    window.showPage = (pageId) => {
        document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });
        document.getElementById(pageId).style.display = 'block';
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const activeNavItem = document.querySelector(`.nav-item[onclick*="'${pageId}'"]`);
        if(activeNavItem) activeNavItem.classList.add('active');

        const loadFunction = {
            dashboardPage: loadDashboardData,
            studentsPage: loadStudents,
            groupsPage: loadGroups,
            paymentsPage: loadPayments,
            attendancePage: loadAttendance,
            adminPage: loadAdminUserList,
        }[pageId];
        
        if (loadFunction) loadFunction();
    };

    // --- DATA READ/WRITE FUNCTIONS ---

    const loadDashboardData = async () => {
        if (!viewingUid) return;
        const studentCountRef = ref(db, `users/${viewingUid}/students`);
        const groupCountRef = ref(db, `users/${viewingUid}/groups`);
        const paymentsRef = ref(db, `users/${viewingUid}/payments`);

        const studentSnapshot = await get(studentCountRef);
        document.getElementById('studentsCount').textContent = studentSnapshot.size || 0;

        const groupSnapshot = await get(groupCountRef);
        document.getElementById('groupsCount').textContent = groupSnapshot.size || 0;

        const paymentsSnapshot = await get(paymentsRef);
        let total = 0;
        if (paymentsSnapshot.exists()) {
            paymentsSnapshot.forEach(snap => { total += snap.val().amount; });
        }
        document.getElementById('paymentsTotal').textContent = `${total} so'm`;
    };

    const loadGroups = async () => {
        if (!viewingUid) return;
        const groupsRef = ref(db, `users/${viewingUid}/groups`);
        onValue(groupsRef, (snapshot) => {
            const listEl = document.getElementById('groupsList');
            const studentGroupSelect = document.getElementById('studentGroup');
            const attendanceGroupFilter = document.getElementById('attendanceGroupFilter');
            listEl.innerHTML = '';
            studentGroupSelect.innerHTML = '<option value="">Select Group</option>';
            attendanceGroupFilter.innerHTML = '<option value="all">All Groups</option>';

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const group = child.val();
                    const groupId = child.key;
                    listEl.innerHTML += `<div class="list-item"><span>${group.name} (${group.teacher})</span></div>`;
                    studentGroupSelect.innerHTML += `<option value="${groupId}">${group.name}</option>`;
                    attendanceGroupFilter.innerHTML += `<option value="${groupId}">${group.name}</option>`;
                });
            } else {
                listEl.innerHTML = '<p>No groups found.</p>';
            }
        });
    };

    const loadStudents = async () => {
        if (!viewingUid) return;
        const studentsRef = ref(db, `users/${viewingUid}/students`);
        onValue(studentsRef, (snapshot) => {
            const listEl = document.getElementById('studentsList');
            listEl.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((child) => listEl.innerHTML += `<div class="list-item"><span>${child.val().name}</span></div>`);
            } else {
                listEl.innerHTML = '<p>No students found.</p>';
            }
        });
    };

    const loadPayments = async () => {
        if (!viewingUid) return;
        const paymentsRef = ref(db, `users/${viewingUid}/payments`);
        onValue(paymentsRef, (snapshot) => {
            const listEl = document.getElementById('paymentsList');
            listEl.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const p = child.val();
                    listEl.innerHTML += `<div class="list-item"><span>${p.studentName}: ${p.amount} so'm on ${p.date}</span></div>`;
                });
            } else {
                listEl.innerHTML = '<p>No payments found.</p>';
            }
        });
    };

    const loadAttendance = async () => {
        if (!viewingUid) return;
        const date = document.getElementById('attendanceDate').value;
        const groupId = document.getElementById('attendanceGroupFilter').value;
        const studentsRef = ref(db, `users/${viewingUid}/students`);
        const listEl = document.getElementById('attendanceList');
        listEl.innerHTML = '';
        const snapshot = await get(studentsRef);
        if (snapshot.exists()) {
            snapshot.forEach(async (child) => {
                const student = child.val();
                const studentId = child.key;
                if (groupId === 'all' || student.groupId === groupId) {
                    const attRef = ref(db, `users/${viewingUid}/attendance/${date}/${studentId}`);
                    const attSnapshot = await get(attRef);
                    const isPresent = attSnapshot.exists() && attSnapshot.val().present;
                    listEl.innerHTML += `<div class="list-item"><span>${student.name}</span><input type="checkbox" ${isPresent ? 'checked' : ''} onchange="updateAttendance('${date}', '${studentId}', this.checked)"></div>`;
                }
            });
        }
    };

    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentName = document.getElementById('studentName').value;
        const studentPhone = document.getElementById('studentPhone').value;
        const groupId = document.getElementById('studentGroup').value;
        if (!studentName || !groupId || !viewingUid) return;
        await push(ref(db, `users/${viewingUid}/students`), { name: studentName, phone: studentPhone, groupId: groupId });
        closeModal('addStudentModal');
    });

    document.getElementById('addGroupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const groupName = document.getElementById('groupName').value;
        const groupTeacher = document.getElementById('groupTeacher').value;
        if (!groupName || !groupTeacher || !viewingUid) return;
        await push(ref(db, `users/${viewingUid}/groups`), { name: groupName, teacher: groupTeacher });
        closeModal('addGroupModal');
    });

    document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('paymentStudent').value;
        const amount = document.getElementById('paymentAmount').value;
        const date = document.getElementById('paymentDate').value;
        if (!studentId || !amount || !date || !viewingUid) return;
        const studentName = document.querySelector('#paymentStudent option:checked').textContent;
        await push(ref(db, `users/${viewingUid}/payments`), { studentId, studentName, amount: Number(amount), date });
        closeModal('addPaymentModal');
    });

    window.updateAttendance = async (date, studentId, isPresent) => {
        if (!viewingUid) return;
        await set(ref(db, `users/${viewingUid}/attendance/${date}/${studentId}`), { present: isPresent });
    };

    // --- MODALS & LISTENERS ---
    const loadStudentsForPayments = async () => {
        if (!viewingUid) return;
        const studentsRef = ref(db, `users/${viewingUid}/students`);
        const snapshot = await get(studentsRef);
        const selectEl = document.getElementById('paymentStudent');
        selectEl.innerHTML = '<option value="">Select Student</option>';
        if(snapshot.exists()) snapshot.forEach(c => { selectEl.innerHTML += `<option value="${c.key}">${c.val().name}</option>`; });
    };

    window.openModal = (modalId) => {
        if (modalId === 'addPaymentModal') loadStudentsForPayments();
        if (modalId === 'changePasswordModal') closeModal('settingsModal');
        document.getElementById(modalId).style.display = 'flex';
    };
    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        modal.style.display = 'none';
        if (modalId === 'changePasswordModal') {
            document.getElementById('reauthSection').style.display = 'none';
            document.getElementById('changePasswordForm').reset();
        }
    };

    document.getElementById('attendanceDate').valueAsDate = new Date();
    document.getElementById('attendanceDate').addEventListener('change', loadAttendance);
    document.getElementById('attendanceGroupFilter').addEventListener('change', loadAttendance);

    window.toggleAuthForms = () => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        if (loginForm.style.display === 'none') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    };
});
