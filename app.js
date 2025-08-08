// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  query, 
  orderByChild, 
  equalTo,
  remove,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// Navigation functions
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = pageId === 'authSection' ? 'flex' : 'block';
    targetPage.classList.add('active');
    
    if (currentUser && pageId !== 'authSection') {
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      
      const navItems = {
        'dashboardSection': 0,
        'studentsPage': 1,
        'attendancePage': 2,
        'paymentsPage': 3
      };
      
      if (navItems[pageId] !== undefined) {
        document.querySelectorAll('.nav-item')[navItems[pageId]].classList.add('active');
      }
    }
    
    if (pageId === 'dashboardSection') {
      loadDashboardData();
    } else if (pageId === 'studentsPage') {
      loadStudents();
    } else if (pageId === 'attendancePage') {
      loadAttendanceData();
    } else if (pageId === 'paymentsPage') {
      loadPayments();
    }
  } else {
    console.error(`Page with ID ${pageId} not found!`);
    showToast(`Sahifa topilmadi: ${pageId}`, 'error');
  }
}

window.showPage = showPage;

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
window.closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('attendanceDate').valueAsDate = new Date();
    document.getElementById('attendanceDate').addEventListener('change', loadAttendance);
    document.getElementById('attendanceGroupFilter').addEventListener('change', loadAttendance);
});

// --- AUTHENTICATION ---

window.registerUser = async () => {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    if (!email || !password) return alert("Please enter email and password.");
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, `users/${cred.user.uid}/profile`), { email, disabled: false });
        alert("Registration successful!");
    } catch (error) { alert(`Registration failed: ${error.message}`); }
};

window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return alert("Please enter email and password.");
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

window.logoutUser = () => signOut(auth);

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword) return alert('Please enter a new password.');

    try {
        await updatePassword(currentUser, newPassword);
        alert('Password updated successfully!');
        closeModal('changePasswordModal');
    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            alert('This operation is sensitive and requires recent authentication. Please enter your current password to continue.');
            document.getElementById('reauthSection').style.display = 'block';
            const currentPassword = await new Promise((resolve) => {
                const form = document.getElementById('changePasswordForm');
                const handler = (submitEvent) => {
                    submitEvent.preventDefault();
                    form.removeEventListener('submit', handler);
                    resolve(document.getElementById('currentPassword').value);
                };
                form.addEventListener('submit', handler);
            });

            if (currentPassword) {
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                try {
                    await reauthenticateWithCredential(currentUser, credential);
                    await updatePassword(currentUser, newPassword);
                    alert('Password updated successfully!');
                    closeModal('changePasswordModal');
                } catch (reauthError) {
                    alert(`Re-authentication failed: ${reauthError.message}`);
                }
            }
        } else {
            alert(`Password update failed: ${error.message}`);
        }
    }
});

// Student functions
window.showAddStudentForm = function() {
  const form = document.getElementById('addStudentForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.addStudent = async function() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const email = document.getElementById('studentEmail').value.trim();
  
  if (!name) {
    showToast("Iltimos, o'quvchi ismini kiriting!", 'error');
    return;
  }
  
  const saveButton = document.querySelector('#addStudentForm button[onclick="addStudent()"]');
  const originalText = saveButton.innerHTML;
  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...';
  
  try {
    const studentRef = push(ref(database, 'students'));
    await set(studentRef, {
      name: name,
      phone: phone || '',
      email: email || '',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid
    });
    
    showToast("O'quvchi qo'shildi!", 'success');
    document.getElementById('studentName').value = '';
    document.getElementById('studentPhone').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('addStudentForm').style.display = 'none';
    loadStudents();
  } catch (error) {
    console.error('Error adding student:', error);
    showToast("Xato: " + error.message, 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="fas fa-save"></i> Saqlash';
  }
};

window.editStudent = function(studentId) {
  const studentRef = ref(database, `students/${studentId}`);
  onValue(studentRef, (snapshot) => {
    const student = snapshot.val();
    if (!student) {
      showToast("O'quvchi ma'lumotlari topilmadi", 'error');
      return;
    }
    
    const editForm = document.getElementById('editStudentForm') || createEditForm();
    editForm.style.display = 'block';
    
    document.getElementById('editStudentId').value = studentId;
    document.getElementById('editStudentName').value = student.name || '';
    document.getElementById('editStudentPhone').value = student.phone || '';
    document.getElementById('editStudentEmail').value = student.email || '';
  }, (error) => {
    console.error('Error fetching student:', error);
    showToast("O'quvchi ma'lumotlarini olishda xato: " + error.message, 'error');
  });
};

window.updateStudent = async function() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const studentId = document.getElementById('editStudentId').value;
  const name = document.getElementById('editStudentName').value.trim();
  const phone = document.getElementById('editStudentPhone').value.trim();
  const email = document.getElementById('editStudentEmail').value.trim();
  
  if (!studentId || !name) {
    showToast("Iltimos, barcha maydonlarni to'ldiring!", 'error');
    return;
  }
  
  const updateButton = document.querySelector('#editStudentForm button[onclick="updateStudent()"]');
  const originalText = updateButton.innerHTML;
  updateButton.disabled = true;
  updateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yangilanmoqda...';
  
  try {
    const studentRef = ref(database, `students/${studentId}`);
    await set(studentRef, {
      name: name,
      phone: phone || '',
      email: email || '',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid
    });
    
    showToast("O'quvchi ma'lumotlari yangilandi!", 'success');
    document.getElementById('editStudentForm').style.display = 'none';
    loadStudents();
  } catch (error) {
    console.error('Error updating student:', error);
    showToast("Xato: " + error.message, 'error');
  } finally {
    updateButton.disabled = false;
    updateButton.innerHTML = '<i class="fas fa-save"></i> Yangilash';
  }
};

window.deleteStudent = async function(studentId) {
  if (!confirm("Haqiqatan ham ushbu o'quvchini o'chirmoqchimisiz?")) return;
  
  try {
    const studentRef = ref(database, `students/${studentId}`);
    await remove(studentRef);
    showToast("O'quvchi o'chirildi!", 'success');
    loadStudents();
  } catch (error) {
    console.error('Error deleting student:', error);
    showToast("Xato: " + error.message, 'error');
  }
};

function createEditForm() {
  const studentsPage = document.getElementById('studentsPage');
  const editForm = document.createElement('div');
  editForm.id = 'editStudentForm';
  editForm.className = 'form-container';
  editForm.style.display = 'none';
  editForm.innerHTML = `
    <h3>O'quvchi ma'lumotlarini tahrirlash</h3>
    <input type="hidden" id="editStudentId">
    <div class="input-group">
      <i class="fas fa-user"></i>
      <input type="text" id="editStudentName" placeholder="O'quvchi ismi">
    </div>
    <div class="input-group">
      <i class="fas fa-phone"></i>
      <input type="tel" id="editStudentPhone" placeholder="Telefon raqami">
    </div>
    <div class="input-group">
      <i class="fas fa-envelope"></i>
      <input type="email" id="editStudentEmail" placeholder="Elektron pochta">
    </div>
    <div class="form-actions">
      <button class="btn secondary-btn" onclick="document.getElementById('editStudentForm').style.display='none'">
        Bekor qilish
      </button>
      <button class="btn primary-btn" onclick="updateStudent()">
        <i class="fas fa-save"></i> Yangilash
      </button>
      <button class="btn danger-btn" onclick="deleteStudent(document.getElementById('editStudentId').value)">
        <i class="fas fa-trash"></i> O'chirish
      </button>
    </div>
  `;
  studentsPage.appendChild(editForm);
  return editForm;
}

// Attendance functions
window.markAllPresent = async function() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const date = document.getElementById('attendanceDate').value;
  if (!date) {
    showToast("Iltimos, sanani tanlang!", 'error');
    return;
  }
  
  try {
    const studentsQuery = query(
      ref(database, 'students'),
      orderByChild('createdBy'),
      equalTo(currentUser.uid)
    );
    
    const snapshot = await get(studentsQuery);
    if (!snapshot.exists()) {
      showToast("O'quvchilar topilmadi", 'error');
      return;
    }
    
    const updates = {};
    const promises = [];
    
    snapshot.forEach((studentSnapshot) => {
      const studentId = studentSnapshot.key;
      const attendanceRef = ref(database, `students/${studentId}/attendance/${date}`);
      promises.push(
        set(attendanceRef, {
          present: true,
          markedAt: new Date().toISOString(),
          markedBy: currentUser.uid
        })
      );
    });
    
    await Promise.all(promises);
    showToast("Barcha o'quvchilar keldi deb belgilandi", 'success');
    loadAttendanceData();
  } catch (error) {
    console.error('Error marking all present:', error);
    showToast("Davomat belgilashda xato: " + error.message, 'error');
  }
};

function loadAttendanceData() {
  if (!currentUser) {
    console.error('User not authenticated');
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const dateInput = document.getElementById('attendanceDate');
  const attendanceList = document.getElementById('attendanceList');
  
  if (!dateInput || !attendanceList) {
    console.error('Required elements not found');
    showToast('Interfeys elementlari topilmadi', 'error');
    return;
  }
  
  const date = dateInput.value;
  attendanceList.innerHTML = '<div class="loading">Yuklanmoqda...</div>';
  
  const studentsQuery = query(
    ref(database, 'students'),
    orderByChild('createdBy'),
    equalTo(currentUser.uid)
  );
  
  onValue(studentsQuery, (snapshot) => {
    try {
      attendanceList.innerHTML = '';
      
      if (!snapshot.exists()) {
        attendanceList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-graduate"></i>
            <p>Hali o'quvchilar qo'shilmagan</p>
            <button class="btn primary-btn" onclick="showPage('studentsPage')">
              <i class="fas fa-plus"></i> O'quvchi qo'shish
            </button>
          </div>
        `;
        return;
      }
      
      let hasStudents = false;
      snapshot.forEach((studentSnapshot) => {
        const student = studentSnapshot.val();
        const studentId = studentSnapshot.key;
        
        if (!student || !student.name) return;
        hasStudents = true;
        
        const attendanceItem = document.createElement('div');
        attendanceItem.className = 'list-item attendance-item';
        attendanceItem.innerHTML = `
          <div class="attendance-info">
            <h4>${student.name}</h4>
            ${student.phone ? `<p><i class="fas fa-phone"></i> ${student.phone}</p>` : ''}
            <p class="attendance-status-text"></p>
          </div>
          <div class="attendance-status">
            <label class="switch">
              <input type="checkbox" id="attendance_${studentId}" data-student-id="${studentId}">
              <span class="slider round"></span>
            </label>
          </div>
        `;
        attendanceList.appendChild(attendanceItem);
        
        const attendanceRef = ref(database, `students/${studentId}/attendance/${date}`);
        onValue(attendanceRef, (attendanceSnapshot) => {
          const checkbox = document.getElementById(`attendance_${studentId}`);
          const statusText = attendanceItem.querySelector('.attendance-status-text');
          
          if (checkbox && statusText) {
            const attendance = attendanceSnapshot.val();
            checkbox.checked = attendance && attendance.present;
            statusText.innerHTML = attendance && attendance.present 
              ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i> Keldi'
              : '<i class="fas fa-times-circle" style="color: var(--danger-color);"></i> Kelmadi';
            
            checkbox.onchange = function() {
              updateAttendance(studentId, date, this.checked);
            };
          }
        }, (error) => {
          console.error('Error fetching attendance:', error);
          showToast("Davomat ma'lumotlarini olishda xato: " + error.message, 'error');
        });
      });
      
      if (!hasStudents) {
        attendanceList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-graduate"></i>
            <p>Hali o'quvchilar qo'shilmagan</p>
            <button class="btn primary-btn" onclick="showPage('studentsPage')">
              <i class="fas fa-plus"></i> O'quvchi qo'shish
            </button>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      attendanceList.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-circle"></i>
          <p>Xatolik yuz berdi: ${error.message}</p>
        </div>
      `;
    }
  }, (error) => {
    console.error('Error in attendance query:', error);
    showToast("Davomat ma'lumotlarini yuklashda xato: " + error.message, 'error');
    attendanceList.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-circle"></i>
        <p>Xatolik yuz berdi: ${error.message}</p>
      </div>
    `;
  });
}

async function updateAttendance(studentId, date, isPresent) {
  if (!currentUser || !studentId || !date) {
    console.error('Invalid parameters for updateAttendance');
    showToast('Noto\'g\'ri ma\'lumotlar', 'error');
    return;
  }
  
  const attendanceRef = ref(database, `students/${studentId}/attendance/${date}`);
  const checkbox = document.getElementById(`attendance_${studentId}`);
  
  if (checkbox) {
    checkbox.disabled = true;
  }
  
  try {
    await set(attendanceRef, {
      present: isPresent,
      markedAt: new Date().toISOString(),
      markedBy: currentUser.uid
    });
    
    showToast(isPresent ? "O'quvchi keldi deb belgilandi" : "O'quvchi kelmadi deb belgilandi", 'success');
  } catch (error) {
    console.error('Error updating attendance:', error);
    showToast("Davomatni yangilashda xato: " + error.message, 'error');
    if (checkbox) {
      checkbox.checked = !isPresent;
    }
  } finally {
    if (checkbox) {
      checkbox.disabled = false;
    }
  }
}

// Data loading functions
function loadDashboardData() {
  if (!currentUser) return;
  
  const studentsQuery = query(
    ref(database, 'students'),
    orderByChild('createdBy'),
    equalTo(currentUser.uid)
  );
  
  onValue(studentsQuery, (snapshot) => {
    const count = snapshot.size || 0;
    document.getElementById('studentsCount').textContent = count;
  }, (error) => {
    console.error('Error loading students count:', error);
    showToast("O'quvchilar sonini yuklashda xato", 'error');
  });
  
  const today = new Date().toISOString().split('T')[0];
  let attendanceCount = 0;
  
  get(studentsQuery).then((snapshot) => {
    if (snapshot.exists()) {
      const promises = [];
      snapshot.forEach((studentSnapshot) => {
        const studentId = studentSnapshot.key;
        const attendanceRef = ref(database, `students/${studentId}/attendance/${today}`);
        promises.push(get(attendanceRef));
      });
      
      Promise.all(promises).then((results) => {
        results.forEach((attendanceSnapshot) => {
          if (attendanceSnapshot.exists() && attendanceSnapshot.val().present) {
            attendanceCount++;
          }
        });
        document.getElementById('attendanceCount').textContent = attendanceCount;
      });
    } else {
      document.getElementById('attendanceCount').textContent = '0';
    }
  }).catch((error) => {
    console.error('Error loading attendance count:', error);
    showToast("Davomat sonini yuklashda xato", 'error');
  });
}

function loadStudents() {
  if (!currentUser) {
    console.error('No current user');
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const studentsList = document.getElementById('studentsList');
  if (!studentsList) {
    console.error('studentsList element not found!');
    showToast('O\'quvchilar ro\'yxati topilmadi', 'error');
    return;
  }
  
  studentsList.innerHTML = '<div class="loading">Yuklanmoqda...</div>';
  
  const studentsQuery = query(
    ref(database, 'students'),
    orderByChild('createdBy'),
    equalTo(currentUser.uid)
  );
  
  onValue(studentsQuery, (snapshot) => {
    studentsList.innerHTML = '';
    let hasStudents = false;
    
    snapshot.forEach((childSnapshot) => {
      const student = childSnapshot.val();
      const studentId = childSnapshot.key;
      
      if (student && student.name) {
        hasStudents = true;
        const studentElement = document.createElement('div');
        studentElement.className = 'list-item';
        studentElement.innerHTML = `
          <div class="list-item-info">
            <h4>${student.name}</h4>
            ${student.phone ? `<p><i class="fas fa-phone"></i> ${student.phone}</p>` : ''}
            ${student.email ? `<p><i class="fas fa-envelope"></i> ${student.email}</p>` : ''}
            <p class="student-meta">
              <small>Qo'shilgan: ${new Date(student.createdAt || new Date()).toLocaleDateString()}</small>
            </p>
          </div>
          <div class="list-item-actions">
            <button class="icon-btn" onclick="editStudent('${studentId}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn danger" onclick="deleteStudent('${studentId}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
        studentsList.appendChild(studentElement);
      }
    });
    
    if (!hasStudents) {
      studentsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-graduate"></i>
          <p>Hali o'quvchilar qo'shilmagan</p>
          <button class="btn primary-btn" onclick="showAddStudentForm()">
            <i class="fas fa-plus"></i> O'quvchi qo'shish
          </button>
        </div>
      `;
    }
  }, (error) => {
    console.error('Error loading students:', error);
    showToast("O'quvchilarni yuklashda xato: " + error.message, 'error');
    studentsList.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-circle"></i>
        <p>Xatolik yuz berdi: ${error.message}</p>
      </div>
    `;
  });
}

// Utility functions
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : ''}
      ${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : ''}
      ${type === 'info' ? '<i class="fas fa-info-circle"></i>' : ''}
    </div>
    <div class="toast-message">${message}</div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('uz-UZ', { 
    style: 'decimal',
    maximumFractionDigits: 0 
  }).format(amount) + " so'm";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

// Payment functions
async function loadStudentsForPaymentForm() {
  if (!currentUser) return;
  
  const studentSelect = document.getElementById('paymentStudent');
  if (!studentSelect) return;
  
  while (studentSelect.options.length > 1) {
    studentSelect.remove(1);
  }
  
  try {
    const studentsQuery = query(
      ref(database, 'students'),
      orderByChild('createdBy'),
      equalTo(currentUser.uid)
    );
    
    const snapshot = await get(studentsQuery);
    studentsForPayments = [];
    
    snapshot.forEach(childSnapshot => {
      const student = childSnapshot.val();
      if (student && student.name) {
        studentsForPayments.push({
          id: childSnapshot.key,
          ...student
        });
        
        const option = document.createElement('option');
        option.value = childSnapshot.key;
        option.textContent = student.name;
        studentSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error loading students for payment form:', error);
    showToast("O'quvchilarni yuklashda xato", 'error');
  }
}

window.showAddPaymentModal = function() {
  const modal = document.getElementById('paymentModal');
  if (!modal) {
    showToast('To\'lov formasi topilmadi', 'error');
    return;
  }
  
  const dateInput = document.getElementById('paymentDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  loadStudentsForPaymentForm();
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
};

window.addPayment = async function(event) {
  event.preventDefault();
  
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const studentId = document.getElementById('paymentStudent').value;
  const amount = parseInt(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  const type = document.getElementById('paymentType').value;
  const comment = document.getElementById('paymentComment').value;
  
  if (!studentId || !amount || !date) {
    showToast("Iltimos, barcha maydonlarni to'ldiring", 'error');
    return;
  }
  
  if (amount <= 0) {
    showToast("To'lov miqdori 0 dan katta bo'lishi kerak", 'error');
    return;
  }
  
  try {
    const paymentRef = push(ref(database, `students/${studentId}/payments`));
    await set(paymentRef, {
      amount: amount,
      date: date,
      type: type,
      comment: comment || '',
      createdAt: new Date().toISOString(),
      markedBy: currentUser.uid
    });
    
    const studentRef = ref(database, `students/${studentId}`);
    await update(studentRef, {
      lastPaymentDate: date
    });
    
    showToast("To'lov muvaffaqiyatli qo'shildi", 'success');
    closeModal('paymentModal');
    document.getElementById('paymentForm').reset();
    loadPayments();
  } catch (error) {
    console.error('Error adding payment:', error);
    showToast("To'lov qo'shishda xato: " + error.message, 'error');
  }
};

window.loadPayments = async function() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const paymentsList = document.getElementById('paymentsList');
  const monthFilter = document.getElementById('paymentMonth')?.value;
  
  if (!paymentsList) {
    showToast('To\'lovlar ro\'yxati topilmadi', 'error');
    return;
  }
  
  paymentsList.innerHTML = '<div class="loading">Yuklanmoqda...</div>';
  
  try {
    const studentsQuery = query(
      ref(database, 'students'),
      orderByChild('createdBy'),
      equalTo(currentUser.uid)
    );
    
    const studentsSnapshot = await get(studentsQuery);
    const students = [];
    const allPayments = [];
    
    if (studentsSnapshot.exists()) {
      studentsSnapshot.forEach(studentSnapshot => {
        const student = studentSnapshot.val();
        const studentId = studentSnapshot.key;
        
        students.push({
          id: studentId,
          ...student
        });
        
        if (student.payments) {
          for (const paymentId in student.payments) {
            const payment = student.payments[paymentId];
            allPayments.push({
              id: paymentId,
              studentId: studentId,
              studentName: student.name || 'Noma\'lum',
              ...payment
            });
          }
        }
      });
      
      payments = monthFilter 
        ? allPayments.filter(payment => payment.date?.split('-')[1] === monthFilter)
        : allPayments;
      
      payments.sort((a, b) => new Date(b.date) - new Date(a.date));
      updatePaymentsUI(students);
      updatePaymentStats();
    } else {
      payments = [];
      updatePaymentsUI([]);
    }
  } catch (error) {
    console.error('Error loading payments:', error);
    showToast("To'lovlarni yuklashda xato: " + error.message, 'error');
    paymentsList.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-circle"></i>
        <p>Xatolik yuz berdi: ${error.message}</p>
      </div>
    `;
  }
};

function updatePaymentsUI(students) {
  const paymentsList = document.getElementById('paymentsList');
  if (!paymentsList) return;
  
  if (payments.length === 0) {
    paymentsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-money-bill-wave"></i>
        <p>To'lovlar topilmadi</p>
        <button class="btn primary-btn" onclick="showAddPaymentModal()">
          <i class="fas fa-plus"></i> To'lov qo'shish
        </button>
      </div>
    `;
    return;
  }
  
  let html = '';
  payments.forEach(payment => {
    const student = students.find(s => s.id === payment.studentId);
    const studentName = student ? student.name : 'Noma\'lum';
    const studentInitials = studentName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    const paymentType = payment.type === 'naqd' ? 'Naqd' : 
                       payment.type === 'karta' ? 'Karta' : 
                       payment.type === 'bank' ? 'Bank' : 
                       payment.type === 'click' ? 'Click' : 
                       payment.type === 'payme' ? 'Payme' : payment.type;
    
    html += `
      <div class="payment-item" data-payment-id="${payment.id}">
        <div class="payment-avatar">${studentInitials}</div>
        <div class="payment-info">
          <div class="payment-header">
            <h4 title="${studentName}">${studentName}</h4>
            <span class="payment-date">
              <i class="far fa-calendar-alt"></i> 
              ${formatDate(payment.date)}
            </span>
          </div>
          <div class="payment-meta">
            <span class="payment-tag">
              <i class="fas fa-${payment.type === 'naqd' ? 'money-bill-wave' : 
                                payment.type === 'karta' ? 'credit-card' : 
                                payment.type === 'bank' ? 'university' : 
                                payment.type === 'click' ? 'mouse-pointer' : 
                                payment.type === 'payme' ? 'mobile-alt' : 'globe'}"></i>
              ${paymentType}
            </span>
            ${payment.comment ? `
              <span class="payment-tag">
                <i class="far fa-comment-dots"></i>
                ${payment.comment.length > 15 ? payment.comment.substring(0, 15) + '...' : payment.comment}
              </span>` : ''}
          </div>
        </div>
        <div class="payment-amount-wrapper">
          <div class="payment-amount">${formatCurrency(payment.amount)}</div>
        </div>
        <div class="payment-actions">
          <button class="payment-action-btn delete" onclick="confirmDeletePayment('${payment.studentId}', '${payment.id}')" title="O'chirish">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  paymentsList.innerHTML = html;
}

function updatePaymentStats() {
  if (payments.length === 0) {
    document.getElementById('totalPayments').textContent = '0 so\'m';
    document.getElementById('paidCount').textContent = '0';
    document.getElementById('pendingCount').textContent = '0';
    return;
  }
  
  const totalAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  document.getElementById('totalPayments').textContent = formatCurrency(totalAmount);
  document.getElementById('paidCount').textContent = payments.length;
  document.getElementById('pendingCount').textContent = '0';
}

window.filterPayments = function() {
  const searchTerm = document.getElementById('paymentSearch')?.value.toLowerCase();
  if (!searchTerm) {
    loadPayments();
    return;
  }
  
  const filteredPayments = payments.filter(payment => {
    const student = studentsForPayments.find(s => s.id === payment.studentId);
    const studentName = student ? student.name.toLowerCase() : '';
    const amount = payment.amount.toString();
    const type = payment.type.toLowerCase();
    const comment = (payment.comment || '').toLowerCase();
    
    return (
      studentName.includes(searchTerm) ||
      amount.includes(searchTerm) ||
      type.includes(searchTerm) ||
      comment.includes(searchTerm)
    );
  });
  
  const originalPayments = [...payments];
  payments = filteredPayments;
  updatePaymentsUI(studentsForPayments);
  payments = originalPayments;
};

window.confirmDeletePayment = function(studentId, paymentId) {
  const modal = document.getElementById('confirmModal');
  if (!modal) return;
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  if (confirmBtn) {
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => deletePayment(studentId, paymentId);
  }
  
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
};

async function deletePayment(studentId, paymentId) {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  try {
    const paymentRef = ref(database, `students/${studentId}/payments/${paymentId}`);
    await remove(paymentRef);
    showToast("To'lov muvaffaqiyatli o'chirildi", 'success');
    closeModal('confirmModal');
    loadPayments();
  } catch (error) {
    console.error('Error deleting payment:', error);
    showToast("To'lovni o'chirishda xato: " + error.message, 'error');
  }
}

// Report functions - PDF va Excel export uchun soddalashtirilgan
window.exportAttendanceReport = async function(format) {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const date = document.getElementById('attendanceDate').value;
  if (!date) {
    showToast("Iltimos, sanani tanlang!", 'error');
    return;
  }
  
  try {
    const studentsQuery = query(
      ref(database, 'students'),
      orderByChild('createdBy'),
      equalTo(currentUser.uid)
    );
    
    const snapshot = await get(studentsQuery);
    if (!snapshot.exists()) {
      showToast("O'quvchilar topilmadi", 'error');
      return;
    }
    
    const reportData = [];
    const promises = [];
    
    snapshot.forEach((studentSnapshot) => {
      const student = studentSnapshot.val();
      const studentId = studentSnapshot.key;
      
      if (student && student.name) {
        const attendanceRef = ref(database, `students/${studentId}/attendance/${date}`);
        const promise = get(attendanceRef).then((attendanceSnapshot) => {
          const attendance = attendanceSnapshot.val();
          
          reportData.push({
            name: student.name,
            phone: student.phone || '-',
            email: student.email || '-',
            status: attendance && attendance.present ? 'Keldi' : 'Kelmadi',
            markedAt: attendance ? new Date(attendance.markedAt).toLocaleString('uz-UZ') : '-'
          });
        });
        
        promises.push(promise);
      }
    });
    
    await Promise.all(promises);
    
    if (format === 'pdf') {
      generateAttendancePDF(reportData, date);
    } else if (format === 'excel') {
      generateAttendanceCSV(reportData, date);
    }
  } catch (error) {
    console.error('Error generating attendance report:', error);
    showToast("Hisobotni yaratishda xato: " + error.message, 'error');
  }
};

function generateAttendancePDF(data, date) {
  try {
    // jsPDF library check
    if (typeof window.jsPDF === 'undefined') {
      showToast('PDF kutubxonasi yuklanmadi', 'error');
      return;
    }
    
    const { jsPDF } = window.jsPDF;
    const doc = new jsPDF();
    
    // Set title
    doc.setFontSize(16);
    doc.text("Davomat Hisoboti", 20, 20);
    doc.text(`Sana: ${formatDate(date)}`, 20, 30);
    
    // Simple table without autoTable
    let yPosition = 50;
    doc.setFontSize(10);
    
    // Headers
    doc.text("Ism", 20, yPosition);
    doc.text("Telefon", 70, yPosition);
    doc.text("Email", 110, yPosition);
    doc.text("Holati", 160, yPosition);
    
    yPosition += 10;
    
    // Data rows
    data.forEach((item, index) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(item.name.substring(0, 20), 20, yPosition);
      doc.text(item.phone.substring(0, 15), 70, yPosition);
      doc.text(item.email.substring(0, 20), 110, yPosition);
      doc.text(item.status, 160, yPosition);
      
      yPosition += 8;
    });
    
    doc.save(`davomat_hisoboti_${date}.pdf`);
    showToast('PDF hisoboti yuklab olindi', 'success');
  } catch (error) {
    console.error('Error generating PDF:', error);
    showToast('PDF yaratishda xato: ' + error.message, 'error');
  }
}

function generateAttendanceCSV(data, date) {
  try {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Davomat Hisoboti\n";
    csvContent += `Sana: ${formatDate(date)}\n\n`;
    csvContent += "Ism,Telefon,Email,Holati,Belgilangan vaqt\n";
    
    data.forEach(item => {
      csvContent += `"${item.name}","${item.phone}","${item.email}","${item.status}","${item.markedAt}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `davomat_hisoboti_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV hisoboti yuklab olindi', 'success');
  } catch (error) {
    console.error('Error generating CSV:', error);
    showToast('CSV yaratishda xato: ' + error.message, 'error');
  }
}

window.exportPaymentsReport = async function(format) {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }
  
  const monthFilter = document.getElementById('paymentMonth')?.value;
  try {
    const studentsQuery = query(
      ref(database, 'students'),
      orderByChild('createdBy'),
      equalTo(currentUser.uid)
    );
    
    const studentsSnapshot = await get(studentsQuery);
    if (!studentsSnapshot.exists()) {
      showToast("O'quvchilar topilmadi", 'error');
      return;
    }
    
    const reportData = [];
    studentsSnapshot.forEach(studentSnapshot => {
      const student = studentSnapshot.val();
      const studentId = studentSnapshot.key;
      
      if (student.payments) {
        for (const paymentId in student.payments) {
          const payment = student.payments[paymentId];
          if (!monthFilter || payment.date.split('-')[1] === monthFilter) {
            reportData.push({
              studentName: student.name || 'Noma\'lum',
              amount: payment.amount,
              date: payment.date,
              type: payment.type === 'naqd' ? 'Naqd' : 
                    payment.type === 'karta' ? 'Karta' : 
                    payment.type === 'bank' ? 'Bank' : 
                    payment.type === 'click' ? 'Click' : 
                    payment.type === 'payme' ? 'Payme' : payment.type,
              comment: payment.comment || '-',
              createdAt: new Date(payment.createdAt).toLocaleString('uz-UZ')
            });
          }
        }
      }
    });
    
    if (reportData.length === 0) {
      showToast("To'lovlar topilmadi", 'error');
      return;
    }
    
    if (format === 'pdf') {
      generatePaymentsPDF(reportData, monthFilter);
    } else if (format === 'excel') {
      generatePaymentsCSV(reportData, monthFilter);
    }
  } catch (error) {
    console.error('Error generating payments report:', error);
    showToast("To'lovlar hisobotini yaratishda xato: " + error.message, 'error');
  }
};

function generatePaymentsPDF(data, monthFilter) {
  try {
    if (typeof window.jsPDF === 'undefined') {
      showToast('PDF kutubxonasi yuklanmadi', 'error');
      return;
    }
    
    const { jsPDF } = window.jsPDF;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("To'lovlar Hisoboti", 20, 20);
    doc.setFontSize(12);
    doc.text(`Vaqt: ${monthFilter ? monthFilter + '-oy' : 'Barcha oylar'}`, 20, 30);
    
    let yPosition = 50;
    doc.setFontSize(10);
    
    // Headers
    doc.text("O'quvchi", 20, yPosition);
    doc.text("Miqdor", 80, yPosition);
    doc.text("Sana", 120, yPosition);
    doc.text("Turi", 160, yPosition);
    
    yPosition += 10;
    
    // Data rows
    data.forEach((item, index) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(item.studentName.substring(0, 20), 20, yPosition);
      doc.text(formatCurrency(item.amount), 80, yPosition);
      doc.text(item.date, 120, yPosition);
      doc.text(item.type, 160, yPosition);
      
      yPosition += 8;
    });
    
    doc.save(`tovlovlar_hisoboti_${monthFilter || 'barcha'}.pdf`);
    showToast('PDF hisoboti yuklab olindi', 'success');
  } catch (error) {
    console.error('Error generating PDF:', error);
    showToast('PDF yaratishda xato: ' + error.message, 'error');
  }
}

function generatePaymentsCSV(data, monthFilter) {
  try {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "To'lovlar Hisoboti\n";
    csvContent += `Vaqt: ${monthFilter ? monthFilter + '-oy' : 'Barcha oylar'}\n\n`;
    csvContent += "O'quvchi,Miqdor,Sana,Turi,Izoh,Qo'shilgan vaqt\n";
    
    data.forEach(item => {
      csvContent += `"${item.studentName}","${item.amount}","${item.date}","${item.type}","${item.comment}","${item.createdAt}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tovlovlar_hisoboti_${monthFilter || 'barcha'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV hisoboti yuklab olindi', 'success');
  } catch (error) {
    console.error('Error generating CSV:', error);
    showToast('CSV yaratishda xato: ' + error.message, 'error');
  }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const attendanceDateInput = document.getElementById('attendanceDate');
  if (attendanceDateInput) {
    attendanceDateInput.value = today;
    attendanceDateInput.addEventListener('change', loadAttendanceData);
  }
  
  const paymentsPage = document.getElementById('paymentsPage');
  if (paymentsPage) {
    const observer = new MutationObserver((mutations) => {
      if (paymentsPage.style.display !== 'none') {
        loadPayments();
      }
    });
    observer.observe(paymentsPage, { attributes: true, attributeFilter: ['style'] });
  }
});