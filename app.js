import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
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
    let viewingUid = null;
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
            adminUserSelect.innerHTML = '<option value="">O\'z ma\'lumotlarim</option>';
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
                    const email = user.profile?.email || 'Noma\'lum';
                    const isDisabled = user.profile?.disabled || false;
                    const itemEl = document.createElement('div');
                    itemEl.className = 'list-item';
                    itemEl.innerHTML = `
                        <span>${email}</span>
                        <button class="btn ${isDisabled ? 'primary-btn' : 'danger-btn'}"
                                style="width: auto;"
                                data-uid="${uid}"
                                data-disable="${!isDisabled}">
                            ${isDisabled ? 'Yoqish' : 'To\'xtatish'}
                        </button>
                    `;
                    listEl.appendChild(itemEl);
                });
            }
        });
    };

    document.getElementById('adminUserManagementList').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const uid = e.target.dataset.uid;
            const shouldDisable = e.target.dataset.disable === 'true';
            toggleUserSuspension(uid, shouldDisable);
        }
    });

    const toggleUserSuspension = async (uid, shouldDisable) => {
        const userProfileRef = ref(db, `users/${uid}/profile`);
        try {
            await update(userProfileRef, { disabled: shouldDisable });
            alert(`Foydalanuvchi hisobi ${shouldDisable ? 'to\'xtatildi' : 'yoqildi'}.`);
        } catch (error) {
            alert(`Operatsiya amalga oshmadi: ${error.message}`);
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
                alert("Ushbu hisob administrator tomonidan to'xtatilgan.");
            }
        } catch (error) { alert(`Kirishda xatolik: ${error.message}`); }
    };

    const registerUser = async (email, password, phone) => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await set(ref(db, `users/${cred.user.uid}/profile`), { email, phone, disabled: false });
            alert("Ro'yxatdan o'tish muvaffaqiyatli!");
        } catch (error) { alert(`Ro'yxatdan o'tishda xatolik: ${error.message}`); }
    };

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loginUser(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const phone = document.getElementById('registerPhone').value;
        if (!email || !password || !phone) return alert("Iltimos, barcha maydonlarni to'ldiring.");
        registerUser(email, password, phone);
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        // Close all modals before logging out
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        signOut(auth);
    });

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const reauthSection = document.getElementById('reauthSection');
        const currentPassword = document.getElementById('currentPassword').value;

        if (reauthSection.style.display === 'block' && !currentPassword) {
            return alert('Qayta autentifikatsiya uchun joriy parolni kiriting.');
        }
        if (!newPassword || newPassword.length < 6) return alert('Yangi parol kamida 6 belgidan iborat bo\'lishi kerak.');

        try {
            if (reauthSection.style.display === 'block') {
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
            }
            await updatePassword(currentUser, newPassword);
            alert('Parol muvaffaqiyatli yangilandi!');
            closeModal('changePasswordModal');
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                reauthSection.style.display = 'block';
                alert('Bu nozik operatsiya. Iltimos, joriy parolingizni kiritib tasdiqlang.');
            } else {
                alert(`Xatolik yuz berdi: ${error.message}`);
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

    const showPage = (pageId) => {
        document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });
        document.getElementById(pageId).style.display = 'block';

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const activeNavItem = document.querySelector(`.nav-item[data-page='${pageId}']`);
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

    const deleteGroup = async (groupId) => {
        if (!viewingUid || !groupId) return;
        if (confirm("Haqiqatan ham ushbu guruhni o'chirmoqchimisiz?")) {
            try {
                await remove(ref(db, `users/${viewingUid}/groups/${groupId}`));
                alert("Guruh o'chirildi.");
            } catch (error) {
                alert(`Xatolik: ${error.message}`);
            }
        }
    };

    document.getElementById('groupsList').addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
            const action = e.target.dataset.action;
            const groupId = e.target.dataset.id;
            if (action === 'delete') {
                deleteGroup(groupId);
            } else if (action === 'edit') {
                const groupRef = ref(db, `users/${viewingUid}/groups/${groupId}`);
                const snapshot = await get(groupRef);
                if (snapshot.exists()) {
                    const group = snapshot.val();
                    document.getElementById('editGroupId').value = groupId;
                    document.getElementById('editGroupName').value = group.name;
                    document.getElementById('editGroupTeacher').value = group.teacher;
                    openModal('editGroupModal');
                }
            }
        }
    });

    const loadGroups = async () => {
        if (!viewingUid) return;
        const groupsRef = ref(db, `users/${viewingUid}/groups`);
        onValue(groupsRef, (snapshot) => {
            const listEl = document.getElementById('groupsList');
            const studentGroupSelect = document.getElementById('studentGroup');
            const attendanceGroupFilter = document.getElementById('attendanceGroupFilter');
            listEl.innerHTML = '';
            studentGroupSelect.innerHTML = '<option value="">Guruhni tanlang</option>';
            attendanceGroupFilter.innerHTML = '<option value="all">Barcha guruhlar</option>';
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const group = child.val();
                    const groupId = child.key;
                    const itemEl = document.createElement('div');
                    itemEl.className = 'list-item';
                    itemEl.innerHTML = `
                        <span>${group.name} (${group.teacher})</span>
                        <div>
                            <button class="btn" style="width: auto; font-size: 0.8rem; padding: 0.25rem 0.5rem; margin-right: 0.5rem;" data-id="${groupId}" data-action="edit">Tahrirlash</button>
                            <button class="btn danger-btn" style="width: auto; font-size: 0.8rem; padding: 0.25rem 0.5rem;" data-id="${groupId}" data-action="delete">O'chirish</button>
                        </div>
                    `;
                    listEl.appendChild(itemEl);
                    studentGroupSelect.innerHTML += `<option value="${groupId}">${group.name}</option>`;
                    attendanceGroupFilter.innerHTML += `<option value="${groupId}">${group.name}</option>`;
                });
            } else {
                listEl.innerHTML = '<p>Guruhlar topilmadi.</p>';
            }
        });
    };

    const deleteStudent = async (studentId) => {
        if (!viewingUid || !studentId) return;
        if (confirm("Haqiqatan ham ushbu o'quvchini o'chirmoqchimisiz?")) {
            try {
                await remove(ref(db, `users/${viewingUid}/students/${studentId}`));
                alert("O'quvchi o'chirildi.");
            } catch (error) {
                alert(`Xatolik: ${error.message}`);
            }
        }
    };

    document.getElementById('studentsList').addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
            const action = e.target.dataset.action;
            const studentId = e.target.dataset.id;

            if (action === 'delete') {
                deleteStudent(studentId);
            } else if (action === 'edit') {
                const studentRef = ref(db, `users/${viewingUid}/students/${studentId}`);
                const snapshot = await get(studentRef);
                if (snapshot.exists()) {
                    const student = snapshot.val();
                    document.getElementById('editStudentId').value = studentId;
                    document.getElementById('editStudentName').value = student.name;
                    document.getElementById('editStudentPhone').value = student.phone || '';

                    // Populate and select the correct group
                    const groupSelect = document.getElementById('editStudentGroup');
                    const groupsRef = ref(db, `users/${viewingUid}/groups`);
                    const groupsSnapshot = await get(groupsRef);
                    groupSelect.innerHTML = '<option value="">Guruhni tanlang</option>';
                    if (groupsSnapshot.exists()) {
                        groupsSnapshot.forEach(groupSnap => {
                            const option = document.createElement('option');
                            option.value = groupSnap.key;
                            option.textContent = groupSnap.val().name;
                            if (groupSnap.key === student.groupId) {
                                option.selected = true;
                            }
                            groupSelect.appendChild(option);
                        });
                    }
                    openModal('editStudentModal');
                }
            }
        }
    });

    document.getElementById('editStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('editStudentId').value;
        const studentName = document.getElementById('editStudentName').value;
        const studentPhone = document.getElementById('editStudentPhone').value;
        const groupId = document.getElementById('editStudentGroup').value;

        if (!studentId || !studentName || !groupId || !viewingUid) return;

        const studentRef = ref(db, `users/${viewingUid}/students/${studentId}`);
        try {
            await update(studentRef, {
                name: studentName,
                phone: studentPhone,
                groupId: groupId
            });
            alert('O\'quvchi ma\'lumotlari yangilandi!');
            closeModal('editStudentModal');
        } catch (error) {
            alert(`Xatolik: ${error.message}`);
        }
    });

    const loadStudents = async () => {
        if (!viewingUid) return;
        const studentsRef = ref(db, `users/${viewingUid}/students`);
        onValue(studentsRef, (snapshot) => {
            const listEl = document.getElementById('studentsList');
            listEl.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const student = child.val();
                    const studentId = child.key;
                    const itemEl = document.createElement('div');
                    itemEl.className = 'list-item';
                    itemEl.innerHTML = `
                        <span>${student.name}</span>
                        <div>
                            <button class="btn" style="width: auto; font-size: 0.8rem; padding: 0.25rem 0.5rem; margin-right: 0.5rem;" data-id="${studentId}" data-action="edit">Tahrirlash</button>
                            <button class="btn danger-btn" style="width: auto; font-size: 0.8rem; padding: 0.25rem 0.5rem;" data-id="${studentId}" data-action="delete">O'chirish</button>
                        </div>
                    `;
                    listEl.appendChild(itemEl);
                });
            } else {
                listEl.innerHTML = '<p>O\'quvchilar topilmadi.</p>';
            }
        });
    };

    const deletePayment = async (paymentId) => {
        if (!viewingUid || !paymentId) return;
        if (confirm("Haqiqatan ham ushbu to'lovni o'chirmoqchimisiz?")) {
            try {
                await remove(ref(db, `users/${viewingUid}/payments/${paymentId}`));
                alert("To'lov o'chirildi.");
            } catch (error) {
                alert(`Xatolik: ${error.message}`);
            }
        }
    };

    document.getElementById('paymentsList').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
            deletePayment(e.target.dataset.id);
        }
    });

    const loadPayments = async () => {
        if (!viewingUid) return;
        const paymentsRef = ref(db, `users/${viewingUid}/payments`);
        onValue(paymentsRef, (snapshot) => {
            const listEl = document.getElementById('paymentsList');
            listEl.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const p = child.val();
                    const paymentId = child.key;
                    const itemEl = document.createElement('div');
                    itemEl.className = 'list-item';
                    itemEl.innerHTML = `
                        <span>${p.studentName}: ${p.amount} so'm - ${p.date}</span>
                        <button class="btn danger-btn" style="width: auto; font-size: 0.8rem; padding: 0.25rem 0.5rem;" data-id="${paymentId}">O'chirish</button>
                    `;
                    listEl.appendChild(itemEl);
                });
            } else {
                listEl.innerHTML = '<p>To\'lovlar topilmadi.</p>';
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

    document.getElementById('editGroupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const groupId = document.getElementById('editGroupId').value;
        const groupName = document.getElementById('editGroupName').value;
        const groupTeacher = document.getElementById('editGroupTeacher').value;
        if (!groupId || !groupName || !groupTeacher || !viewingUid) return;

        const groupRef = ref(db, `users/${viewingUid}/groups/${groupId}`);
        try {
            await update(groupRef, { name: groupName, teacher: groupTeacher });
            alert('Guruh muvaffaqiyatli yangilandi!');
            closeModal('editGroupModal');
        } catch (error) {
            alert(`Xatolik: ${error.message}`);
        }
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

    const loadStudentsForPayments = async () => {
        if (!viewingUid) return;
        const studentsRef = ref(db, `users/${viewingUid}/students`);
        const snapshot = await get(studentsRef);
        const selectEl = document.getElementById('paymentStudent');
        selectEl.innerHTML = '<option value="">O\'quvchini tanlang</option>';
        if(snapshot.exists()) snapshot.forEach(c => { selectEl.innerHTML += `<option value="${c.key}">${c.val().name}</option>`; });
    };

    const openModal = (modalId) => {
        if (modalId === 'addPaymentModal') loadStudentsForPayments();
        const modal = document.getElementById(modalId);
        if(modal) modal.style.display = 'flex';
    };

    const closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.style.display = 'none';
            const form = modal.querySelector('form');
            if (form) {
                try {
                    form.reset();
                } catch (e) {
                    console.error(`Error resetting form in modal ${modalId}:`, e);
                }
            }
            if (modalId === 'changePasswordModal') {
                const reauthSection = document.getElementById('reauthSection');
                if(reauthSection) reauthSection.style.display = 'none';
            }
        }
    };

    // --- UNIVERSAL EVENT LISTENERS ---
    document.addEventListener('click', (e) => {
        // Modal Openers
        if(e.target.matches('#settingsBtn')) openModal('settingsModal');
        if(e.target.matches('#addStudentBtn')) openModal('addStudentModal');
        if(e.target.matches('#addGroupBtn')) openModal('addGroupModal');
        if(e.target.matches('#addPaymentBtn')) openModal('addPaymentModal');
        if(e.target.matches('#changePasswordBtn')) {
            closeModal('settingsModal');
            openModal('changePasswordModal');
        }

        // Modal Closers
        if (e.target.matches('.close-btn')) {
             const modalId = e.target.dataset.modalId;
             if(modalId) closeModal(modalId);
        }
        if (e.target.matches('.modal')) {
             closeModal(e.target.id);
        }

        // Auth Form Toggling
        if(e.target.matches('#showRegister')) {
            e.preventDefault();
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
        }
        if(e.target.matches('#showLogin')) {
            e.preventDefault();
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('registerForm').style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll('.modal').forEach(modal => closeModal(modal.id));
        }
    });

    document.getElementById('attendanceDate').valueAsDate = new Date();
    document.getElementById('attendanceDate').addEventListener('change', loadAttendance);
    document.getElementById('attendanceGroupFilter').addEventListener('change', loadAttendance);

    document.querySelector('.bottom-nav').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) {
            const pageId = navItem.dataset.page;
            if (pageId) {
                showPage(pageId);
            }
        }
    });
});
