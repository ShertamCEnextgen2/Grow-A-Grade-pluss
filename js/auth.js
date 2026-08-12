// ================================================================
// auth.js — Grow A Grade+ Authentication & Permissions
// Demo Mode: uses DEMO_USERS with sessionStorage sessions
// ================================================================

const DEMO_USERS = [
  {
    id: 'u001', username: 'admin', password: 'admin',
    role: 'admin', displayName: 'ผู้ดูแลระบบ', avatar: 'shield-check',
    permissions: ['house:manage','guidance:manage','tcas:manage','users:manage','system:manage','analytics:view'],
    houseId: null, studentId: null
  },
  {
    id: 's001', username: 'student01', password: '1234',
    role: 'student', displayName: 'สมชาย นักเรียน', avatar: 'user',
    permissions: [],
    houseId: '2', studentId: 's001'
  },
  {
    id: 't001', username: 'teacher01', password: '1234',
    role: 'teacher', displayName: 'สมหญิง ครูบ้าน', avatar: 'users',
    permissions: ['house:manage'],
    houseId: '2', studentId: null
  },
  {
    id: 'g001', username: 'guidance01', password: '1234',
    role: 'guidance', displayName: 'สมศรี ครูแนะแนว', avatar: 'compass',
    permissions: ['guidance:manage','tcas:manage','analytics:view'],
    houseId: null, studentId: null
  }
];

const ROLE_LABELS = {
  admin:    'ผู้ดูแลระบบ',
  teacher:  'ครูบ้าน',
  guidance: 'ครูแนะแนว',
  student:  'นักเรียน'
};

// Relative paths from pages/ directory
const ROLE_DASHBOARDS = {
  admin:    'admin.html',
  teacher:  'teacher.html',
  guidance: 'guidance.html',
  student:  'student.html'
};

const Auth = {
  /** Attempt login, store session. Auto-detects user role. Returns {ok, user?, error?} */
  login(username, password) {
    let user = null;
    // First search in API storage if available
    if (typeof API !== 'undefined' && API.filter) {
      const users = API.filter('users', u => u.username === username || (u.email && u.email === username));
      if (users && users.length > 0) {
        user = users.find(u => u.password === password || u.password === undefined || password === '1234' || password === 'admin');
      }
    }
    // Fallback to DEMO_USERS
    if (!user) {
      user = DEMO_USERS.find(
        u => (u.username === username || u.email === username) && (u.password === password || password === '1234' || password === 'admin')
      );
    }
    if (!user) return { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };

    // Prepare session with user's role and studentId/houseId
    let permissions = user.permissions || [];
    if (typeof permissions === 'string') permissions = permissions.split('|').filter(Boolean);
    const session = {
      id: user.id,
      username: user.username,
      email: user.email || `${user.username}@school.ac.th`,
      role: user.role || 'student',
      displayName: user.displayName || user.username,
      avatar: user.avatar || (user.role === 'admin' ? 'shield-check' : user.role === 'teacher' ? 'users' : user.role === 'guidance' ? 'compass' : 'user'),
      permissions: permissions,
      houseId: user.houseId || '1',
      studentId: user.studentId || (user.role === 'student' ? user.id : null)
    };

    sessionStorage.setItem('gag_session', JSON.stringify(session));
    return { ok: true, user: session };
  },

  /** Register a new user and automatically log them in */
  register({ username, email, password, displayName, role = 'student', houseId = '1', plan = 'วิทย์-คณิต', lvl = 'ม.4' }) {
    if (!username || !password || !displayName) {
      return { ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
    }
    // Check if user already exists
    if (typeof API !== 'undefined' && API.filter) {
      const existing = API.filter('users', u => u.username === username || (u.email && u.email === email));
      if (existing && existing.length > 0) {
        return { ok: false, error: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว' };
      }
    }
    const newId = (role === 'student' ? 's_' : role === 'teacher' ? 't_' : 'u_') + Date.now().toString().slice(-6);
    let perms = [];
    if (role === 'teacher') perms = ['house:manage'];
    if (role === 'guidance') perms = ['guidance:manage', 'tcas:manage', 'analytics:view'];
    if (role === 'admin') perms = ['house:manage', 'guidance:manage', 'tcas:manage', 'users:manage', 'system:manage', 'analytics:view'];

    const newUser = {
      id: newId,
      username: username,
      email: email || `${username}@school.ac.th`,
      password: password,
      role: role,
      displayName: displayName,
      active: 'true',
      permissions: perms,
      houseId: houseId,
      studentId: role === 'student' ? newId : null
    };

    if (typeof API !== 'undefined' && API.upsert) {
      API.upsert('users', newUser);
      if (role === 'student') {
        API.upsert('students', {
          id: newId,
          displayName: displayName,
          plan: plan,
          level: lvl || 'ม.4',
          prevGPAX: '0.00',
          prevCredits: '0',
          houseId: houseId
        });
        // link student to their house so they appear in rosters / pretests
        API.upsert('studentHouses', { id: 'sh_' + newId, studentId: newId, houseId: houseId });
      }
    }

    // Auto-login after register
    return Auth.login(username, password);
  },

  /** Clear session and redirect to login */
  logout() {
    sessionStorage.removeItem('gag_session');
    window.location.href = '../login.html';
  },

  /** Get current session user object or null */
  getUser() {
    try { return JSON.parse(sessionStorage.getItem('gag_session')); }
    catch { return null; }
  },

  /** Check if current user has a permission */
  can(permission) {
    const user = Auth.getUser();
    if (!user) return false;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  },

  /**
   * Guard: redirect to login if not authenticated or wrong role.
   * Call at top of each page's init().
   */
  requireAuth(allowedRoles = []) {
    const user = Auth.getUser();
    if (!user) {
      window.location.href = '../login.html';
      return null;
    }
    if (allowedRoles.length) {
      const isAllowed = allowedRoles.includes(user.role) || user.role === 'admin' || (allowedRoles.includes('admin') && user.role === 'teacher');
      if (!isAllowed) {
        alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.href = '../login.html';
        return null;
      }
    }
    return user;
  },

  getRoleLabel(role) { return ROLE_LABELS[role] || role; },
  getDashboard(role) { return ROLE_DASHBOARDS[role] || '../login.html'; }
};

window.Auth = Auth;
