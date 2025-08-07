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
  onAuthStateChanged 
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
const database = getDatabase(app);
const auth = getAuth(app);

// Global variables
const SUPER_ADMIN_EMAIL = "rahimboyislombek@gmail.com";
let currentUser = null;
let isInitialized = false;
let payments = [];
let studentsForPayments = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const mainApp = document.getElementById('mainApp');
  const authSection = document.getElementById('authSection');
  
  if (!authSection) {
    console.error('authSection element not found!');
    return;
  }
  
  if (isInitialized) return;
  isInitialized = true;
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const attendanceDateInput = document.getElementById('attendanceDate');
  if (attendanceDateInput) {
    attendanceDateInput.value = today;
  }
  
  // Check authentication state
  onAuthStateChanged(auth, async (user) => {
    const bottomNav = document.querySelector('.bottom-nav');
    
    if (user) {
      currentUser = user;

      // Super admin always gets access
      if (user.email === SUPER_ADMIN_EMAIL) {
        currentUser.isSuperAdmin = true;
        document.getElementById('userEmail').textContent = user.email;
        document.querySelector('.logout-btn').style.display = 'inline-flex';
        authSection.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (bottomNav) bottomNav.style.display = 'flex';
        document.getElementById('adminNav').style.display = 'flex';
        showPage('dashboardSection');
        loadDashboardData();
        return;
      }

      // Check if user is a staff member or a center admin
      const staffMappingRef = ref(database, `staff_to_center_mapping/${user.uid}`);
      const staffMappingSnapshot = await get(staffMappingRef);

      let centerId;
      let isStaff = false;

      if (staffMappingSnapshot.exists()) {
        // User is a staff member
        isStaff = true;
        centerId = staffMappingSnapshot.val();
      } else {
        // User is a center admin
        isStaff = false;
        centerId = user.uid;
      }

      // Check if the center is active
      const centerRef = ref(database, `centers/${centerId}`);
      const centerSnapshot = await get(centerRef);

      if (centerSnapshot.exists() && centerSnapshot.val().isActive) {
        currentUser.centerId = centerId; // Store centerId for later use

        if (isStaff) {
          currentUser.permissions = centerSnapshot.val().staff[user.uid]?.permissions || {};
          document.getElementById('staffNav').style.display = 'none';

          // Hide nav items based on permissions
          document.querySelector('.nav-item[onclick="showPage(\'studentsPage\')"]').style.display = currentUser.permissions.canManageStudents ? 'flex' : 'none';
          document.querySelector('.nav-item[onclick="showPage(\'attendancePage\')"]').style.display = currentUser.permissions.canMarkAttendance ? 'flex' : 'none';
          document.querySelector('.nav-item[onclick="showPage(\'paymentsPage\')"]').style.display = currentUser.permissions.canViewPayments ? 'flex' : 'none';
        } else {
          // Center admin has all permissions
          currentUser.permissions = { canManageStudents: true, canViewPayments: true, canMarkAttendance: true };
          document.getElementById('staffNav').style.display = 'flex';
        }

        document.getElementById('userEmail').textContent = user.email;
        document.querySelector('.logout-btn').style.display = 'inline-flex';
        authSection.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (bottomNav) bottomNav.style.display = 'flex';
        document.getElementById('adminNav').style.display = 'none';
        showPage('dashboardSection');
        loadDashboardData();
      } else {
        // Center is inactive or doesn't exist
        showToast('Hisobingiz faol emas. Administrator bilan bog\'laning.', 'error');
        const suspensionModal = document.getElementById('suspensionModal');
        if (suspensionModal) {
          suspensionModal.style.display = 'flex';
          setTimeout(() => suspensionModal.classList.add('show'), 10);
        }
        await signOut(auth); // Sign out the user
      }
    } else {
      currentUser = null;
      document.querySelector('.logout-btn').style.display = 'none';
      
      authSection.style.display = 'flex';
      if (mainApp) mainApp.style.display = 'none';
      if (bottomNav) bottomNav.style.display = 'none';
      
      showPage('authSection');
    }
  }, (error) => {
    console.error('Auth state check error:', error);
    showToast('Autentifikatsiya xatosi: ' + error.message, 'error');
    authSection.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    showPage('authSection');
  });
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
        'paymentsPage': 3,
        'staffPage': 4,
        'adminPage': 5
      };
      
      if (navItems[pageId] !== undefined) {
        // Adjust index for admin nav item if it's not visible
        const adminNavIndex = (document.getElementById('adminNav').style.display === 'none') ? -1 : 5;
        if (navItems[pageId] === adminNavIndex) {
          document.querySelectorAll('.nav-item')[adminNavIndex].classList.add('active');
        } else {
          document.querySelectorAll('.nav-item')[navItems[pageId]].classList.add('active');
        }
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
    } else if (pageId === 'adminPage') {
      loadAdminData();
    } else if (pageId === 'staffPage') {
      loadStaffData();
    }
  } else {
    console.error(`Page with ID ${pageId} not found!`);
    showToast(`Sahifa topilmadi: ${pageId}`, 'error');
  }
}

window.showPage = showPage;

// Form switching functions
window.showLoginForm = function() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('registerSection').style.display = 'none';
  document.querySelector('.auth-title').textContent = 'Kirish';
  document.getElementById('passwordInput').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

window.showRegisterForm = function() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('registerSection').style.display = 'block';
  document.querySelector('.auth-title').textContent = "Ro'yxatdan o'tish";
  document.getElementById('passwordInput').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

// Authentication functions
window.loginUser = async function() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  
  if (!email || !password) {
    showToast('Iltimos, email va parolni kiriting!', 'error');
    return false;
  }
  
  try {
    const loginButton = document.querySelector('#loginSection button[type="submit"]');
    const originalText = loginButton.innerHTML;
    loginButton.disabled = true;
    loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kirish...';
    
    await signInWithEmailAndPassword(auth, email, password);
    showToast('Muvaffaqiyatli kirildi!', 'success');
    
    document.getElementById('emailInput').value = '';
    document.getElementById('passwordInput').value = '';
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    let errorMessage = 'Kirish xatosi: ';
    switch (error.code) {
      case 'auth/user-not-found': errorMessage = 'Bunday email topilmadi'; break;
      case 'auth/wrong-password': errorMessage = "Noto'g'ri parol"; break;
      case 'auth/too-many-requests': errorMessage = "Juda ko'p urinishlar"; break;
      case 'auth/user-disabled': errorMessage = 'Hisob o\'chirilgan'; break;
      default: errorMessage += error.message;
    }
    showToast(errorMessage, 'error');
    return false;
  } finally {
    const loginButton = document.querySelector('#loginSection button[type="submit"]');
    loginButton.disabled = false;
    loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Kirish';
  }
}

window.registerUser = async function() {
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!email || !password || !confirmPassword) {
    showToast("Iltimos, barcha maydonlarni to'ldiring!", 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Parol kamida 6 belgidan iborat bo\'lishi kerak', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Parollar mos kelmadi!', 'error');
    return;
  }

  const registerButton = document.querySelector('#registerSection button');
  try {
    const originalText = registerButton.innerHTML;
    registerButton.disabled = true;
    registerButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ro\'yxatdan o\'tilmoqda...';

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check for a pending invitation
    const invitationsQuery = query(ref(database, 'invitations'), orderByChild('email'), equalTo(user.email));
    const snapshot = await get(invitationsQuery);

    if (snapshot.exists()) {
      // This user is a staff member being registered
      let centerId;
      let invitationId;
      snapshot.forEach(child => {
        invitationId = child.key;
        centerId = child.val().centerId;
      });

      // Add user to staff list in the center
      const staffRef = ref(database, `centers/${centerId}/staff/${user.uid}`);
      await set(staffRef, {
        email: user.email,
        permissions: {
          canManageStudents: false,
          canViewPayments: false,
          canMarkAttendance: false
        }
      });

      // Add to staff-to-center mapping
      const mappingRef = ref(database, `staff_to_center_mapping/${user.uid}`);
      await set(mappingRef, centerId);

      // Remove the invitation
      const invitationRef = ref(database, `invitations/${invitationId}`);
      await remove(invitationRef);

      showToast("Xodim sifatida muvaffaqiyatli ro'yxatdan o'tdingiz!", 'success');
    } else {
      // This is a new center admin registering
      const centerRef = ref(database, `centers/${user.uid}`);
      await set(centerRef, {
        ownerEmail: user.email,
        createdAt: new Date().toISOString(),
        isActive: true,
        staff: {}
      });
      showToast("Muvaffaqiyatli ro'yxatdan o'tildi!", 'success');
    }
    showLoginForm();
  } catch (error) {
    console.error('Registration error:', error);
    let errorMessage = "Ro'yxatdan o'tish xatosi: ";
    switch (error.code) {
      case 'auth/email-already-in-use': errorMessage = "Bu email allaqachon ro'yxatdan o'tgan"; break;
      case 'auth/invalid-email': errorMessage = "Noto'g'ri email formati"; break;
      case 'auth/weak-password': errorMessage = 'Parol juda oson'; break;
      default: errorMessage += error.message;
    }
    showToast(errorMessage, 'error');
  } finally {
    const registerButton = document.querySelector('#registerSection button');
    registerButton.disabled = false;
    registerButton.innerHTML = '<i class="fas fa-user-plus"></i> Ro\'yxatdan o\'tish';
  }
}

window.logoutUser = async function() {
  try {
    await signOut(auth);
    showToast('Chiqildi!', 'info');
    showPage('authSection');
  } catch (error) {
    showToast('Chiqish xatosi: ' + error.message, 'error');
  }
}

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
  if (!currentUser.permissions?.canManageStudents) {
    showToast('Sizda o\'quvchi qo\'shish uchun ruxsat yo\'q', 'error');
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
      centerId: currentUser.centerId
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
  if (!currentUser.permissions?.canManageStudents) {
    showToast('Sizda o\'quvchi ma\'lumotlarini tahrirlash uchun ruxsat yo\'q', 'error');
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
      centerId: currentUser.centerId
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
  if (!currentUser.permissions?.canManageStudents) {
    showToast('Sizda o\'quvchini o\'chirish uchun ruxsat yo\'q', 'error');
    return;
  }
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
  if (!currentUser.permissions?.canMarkAttendance) {
    showToast('Sizda davomatni belgilash uchun ruxsat yo\'q', 'error');
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
      orderByChild('centerId'),
      equalTo(currentUser.centerId)
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
  if (currentUser.isSuperAdmin) {
    document.getElementById('attendanceList').innerHTML = '<div class="empty-state"><h2>Admin Panel</h2><p>Markazlarni boshqarish uchun pastdagi Admin menyusidan foydalaning.</p></div>';
    return;
  }

  const canMark = currentUser.permissions?.canMarkAttendance;
  const markAllButton = document.querySelector('#attendancePage .btn[onclick="markAllPresent()"]');
  if (markAllButton) {
    markAllButton.style.display = canMark ? 'inline-flex' : 'none';
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
    orderByChild('centerId'),
    equalTo(currentUser.centerId)
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
              <input type="checkbox" id="attendance_${studentId}" data-student-id="${studentId}" ${!canMark ? 'disabled' : ''}>
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
  if (!currentUser.permissions?.canMarkAttendance) {
    showToast('Sizda davomatni belgilash uchun ruxsat yo\'q', 'error');
    // Revert the checkbox state visually
    const checkbox = document.getElementById(`attendance_${studentId}`);
    if (checkbox) checkbox.checked = !isPresent;
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
  if (currentUser.isSuperAdmin) {
    // Super admin doesn't have a personal dashboard
    document.getElementById('studentsCount').textContent = '-';
    document.getElementById('attendanceCount').textContent = '-';
    document.getElementById('totalPayments').textContent = '-';
    return;
  }
  
  const studentsQuery = query(
    ref(database, 'students'),
    orderByChild('centerId'),
    equalTo(currentUser.centerId)
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
  if (currentUser.isSuperAdmin) {
    document.getElementById('studentsList').innerHTML = '<div class="empty-state"><h2>Admin Panel</h2><p>Markazlarni boshqarish uchun pastdagi Admin menyusidan foydalaning.</p></div>';
    return;
  }

  // UI-level permission check
  const canManage = currentUser.permissions?.canManageStudents;
  const addStudentButton = document.querySelector('#studentsPage .primary-btn[onclick="showAddStudentForm()"]');
  if (addStudentButton) {
    addStudentButton.style.display = canManage ? 'inline-flex' : 'none';
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
    orderByChild('centerId'),
    equalTo(currentUser.centerId)
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
            ${canManage ? `
              <button class="icon-btn" onclick="editStudent('${studentId}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="icon-btn danger" onclick="deleteStudent('${studentId}')">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
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
      orderByChild('centerId'),
      equalTo(currentUser.centerId)
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
  if (!currentUser.permissions?.canViewPayments) {
    showToast('Sizda to\'lov qo\'shish uchun ruxsat yo\'q', 'error');
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
  if (currentUser.isSuperAdmin) {
    document.getElementById('paymentsList').innerHTML = '<div class="empty-state"><h2>Admin Panel</h2><p>Markazlarni boshqarish uchun pastdagi Admin menyusidan foydalaning.</p></div>';
    return;
  }

  // UI-level permission check
  const canView = currentUser.permissions?.canViewPayments;
  const addPaymentButton = document.querySelector('#paymentsPage .btn[onclick="showAddPaymentModal()"]');
  if (addPaymentButton) {
    addPaymentButton.style.display = canView ? 'inline-flex' : 'none';
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
      orderByChild('centerId'),
      equalTo(currentUser.centerId)
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
          ${currentUser.permissions?.canViewPayments ? `
            <button class="payment-action-btn delete" onclick="confirmDeletePayment('${payment.studentId}', '${payment.id}')" title="O'chirish">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
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
  if (!currentUser.permissions?.canViewPayments) {
    showToast('Sizda to\'lovni o\'chirish uchun ruxsat yo\'q', 'error');
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

// Admin functions
function loadAdminData() {
  if (!currentUser || currentUser.email !== SUPER_ADMIN_EMAIL) {
    showToast('Sizda bu sahifaga kirish huquqi yo\'q', 'error');
    showPage('dashboardSection');
    return;
  }

  const centersList = document.getElementById('centersList');
  centersList.innerHTML = '<div class="loading">Markazlar yuklanmoqda...</div>';

  const centersRef = ref(database, 'centers');
  onValue(centersRef, (snapshot) => {
    centersList.innerHTML = '';
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const center = childSnapshot.val();
        const centerId = childSnapshot.key;
        const centerElement = document.createElement('div');
        centerElement.className = 'list-item';
        centerElement.innerHTML = `
          <div class="list-item-info">
            <h4>${center.ownerEmail}</h4>
            <p>Status: ${center.isActive ? 'Aktiv' : 'Bloklangan'}</p>
            <small>Ro'yxatdan o'tgan: ${new Date(center.createdAt).toLocaleDateString()}</small>
          </div>
          <div class="list-item-actions">
            <label class="switch">
              <input type="checkbox" onchange="toggleCenterStatus('${centerId}', this.checked)" ${center.isActive ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
          </div>
        `;
        centersList.appendChild(centerElement);
      });
    } else {
      centersList.innerHTML = '<div class="empty-state"><p>Markazlar topilmadi</p></div>';
    }
  }, (error) => {
    console.error('Error loading centers:', error);
    showToast('Markazlarni yuklashda xato: ' + error.message, 'error');
    centersList.innerHTML = '<div class="error"><p>Markazlarni yuklashda xatolik yuz berdi</p></div>';
  });
}

window.toggleCenterStatus = async function(centerId, isActive) {
  if (!currentUser || currentUser.email !== SUPER_ADMIN_EMAIL) {
    showToast('Bu amalni bajarish uchun sizda huquq yo\'q', 'error');
    return;
  }

  const centerRef = ref(database, `centers/${centerId}`);
  try {
    await update(centerRef, { isActive: isActive });
    showToast(`Markaz statusi ${isActive ? 'aktivlashtirildi' : 'bloklandi'}`, 'success');
  } catch (error) {
    console.error('Error updating center status:', error);
    showToast('Markaz statusini yangilashda xato: ' + error.message, 'error');
    // Revert the switch state on error
    loadAdminData();
  }
}

// Staff Management Functions
window.showInviteStaffForm = function() {
  const form = document.getElementById('inviteStaffForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

function loadStaffData() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }

  const staffList = document.getElementById('staffList');
  staffList.innerHTML = '<div class="loading">Xodimlar yuklanmoqda...</div>';

  const staffRef = ref(database, `centers/${currentUser.uid}/staff`);
  onValue(staffRef, (snapshot) => {
    staffList.innerHTML = '';
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const staffMember = childSnapshot.val();
        const staffId = childSnapshot.key;
        const staffElement = document.createElement('div');
        staffElement.className = 'list-item';
        const permissions = staffMember.permissions || {};
        staffElement.innerHTML = `
          <div class="list-item-info">
            <h4>${staffMember.email}</h4>
          </div>
          <div class="staff-permissions">
            <label class="permission-toggle">
              <input type="checkbox" onchange="updateStaffPermission('${staffId}', 'canManageStudents', this.checked)" ${permissions.canManageStudents ? 'checked' : ''}>
              <span>O'quvchilar</span>
            </label>
            <label class="permission-toggle">
              <input type="checkbox" onchange="updateStaffPermission('${staffId}', 'canViewPayments', this.checked)" ${permissions.canViewPayments ? 'checked' : ''}>
              <span>To'lovlar</span>
            </label>
            <label class="permission-toggle">
              <input type="checkbox" onchange="updateStaffPermission('${staffId}', 'canMarkAttendance', this.checked)" ${permissions.canMarkAttendance ? 'checked' : ''}>
              <span>Davomat</span>
            </label>
          </div>
        `;
        staffList.appendChild(staffElement);
      });
    } else {
      staffList.innerHTML = '<div class="empty-state"><p>Hali xodimlar qo\'shilmagan.</p></div>';
    }
  }, (error) => {
    console.error('Error loading staff:', error);
    staffList.innerHTML = '<div class="error"><p>Xodimlarni yuklashda xatolik yuz berdi.</p></div>';
  });
}

window.updateStaffPermission = async function(staffId, permissionKey, value) {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }

  const permissionRef = ref(database, `centers/${currentUser.uid}/staff/${staffId}/permissions/${permissionKey}`);
  try {
    await set(permissionRef, value);
    showToast('Ruxsat muvaffaqiyatli yangilandi', 'success');
  } catch (error) {
    console.error('Error updating permission:', error);
    showToast('Ruxsatni yangilashda xato: ' + error.message, 'error');
    loadStaffData(); // Re-load to revert checkbox state
  }
}

window.inviteStaff = async function() {
  if (!currentUser) {
    showToast('Iltimos, avval tizimga kiring', 'error');
    return;
  }

  const email = document.getElementById('staffEmail').value.trim();
  if (!email) {
    showToast('Iltimos, xodimning elektron pochtasini kiriting', 'error');
    return;
  }

  try {
    const invitationsRef = ref(database, 'invitations');
    const newInvitationRef = push(invitationsRef);
    await set(newInvitationRef, {
      centerId: currentUser.uid,
      email: email,
      status: 'pending',
      invitedAt: new Date().toISOString()
    });

    showToast(`Taklifnoma ${email} manziliga yuborildi`, 'success');
    document.getElementById('staffEmail').value = '';
    showInviteStaffForm(); // Hide the form after sending
  } catch (error) {
    console.error('Error sending invitation:', error);
    showToast('Taklifnoma yuborishda xato: ' + error.message, 'error');
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
      orderByChild('centerId'),
      equalTo(currentUser.centerId)
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
      orderByChild('centerId'),
      equalTo(currentUser.centerId)
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