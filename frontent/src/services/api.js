// API configuration for admin panel
// Set VITE_API_URL in .env file or use default server URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://work-spot-6.onrender.com/api';

// Base URL without /api for static assets (images, etc.)
export const BASE_URL = API_BASE_URL.replace('/api', '');

console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🔗 Base URL (for assets):', BASE_URL);

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log('📡 API Call:', url);
  
  // Get token from localStorage (fallback if cookies don't work)
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  
  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add Authorization header if token exists (for fallback auth)
  if (token && token !== 'admin-authenticated') {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔑 [apiCall] Adding Authorization header with token');
  } else {
    console.log('🍪 [apiCall] Relying on cookies for authentication');
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
    });

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      let errorMessage = 'Something went wrong';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call error:', error);
    // Handle network errors specifically
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    throw error;
  }
};

// Dashboard API calls
export const dashboardAPI = {
  getTodayAttendance: (dateParams = {}) => {
    const queryString = new URLSearchParams(dateParams).toString();
    return apiCall(`/dashboard/today${queryString ? '?' + queryString : ''}`);
  },
  getDashboard: () => apiCall('/dashboard'),
  getLiveBoard: () => apiCall('/dashboard/live-board'),
  getAllEmployees: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/dashboard/employees?${queryString}`);
  },
  updateEmployee: (employeeId, data) => apiCall(`/dashboard/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Auth API calls
export const authAPI = {
  login: (credentials) => apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  logout: () => apiCall('/auth/logout', { method: 'POST' }),
  checkAuth: () => apiCall('/auth/check'),
};

// Reports API calls
export const reportsAPI = {
  getMonthlyReport: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/reports/monthly${queryString ? `?${queryString}` : ''}`);
  },
  getLateReport: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/reports/late${queryString ? `?${queryString}` : ''}`);
  },
  getOvertimeReport: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/reports/overtime${queryString ? `?${queryString}` : ''}`);
  },
};

export const downloadFile = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');

  const headers = {
    ...options.headers,
  };

  if (token && token !== 'admin-authenticated') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = 'Something went wrong';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.blob();
};

// Holidays API calls
export const holidaysAPI = {
  getAll: (params) => {
    // Accept either a number (year) or an object with params
    const queryParams = typeof params === 'number' 
      ? { year: params } 
      : (params || {});
    const queryString = new URLSearchParams(queryParams).toString();
    return apiCall(`/holidays${queryString ? `?${queryString}` : ''}`);
  },
  getUpcoming: () => apiCall('/holidays/upcoming'),
  getCalendar: (year, month) => apiCall(`/holidays/calendar?year=${year}&month=${month}`),
  getOne: (id) => apiCall(`/holidays/${id}`),
  checkByDate: (date) => apiCall(`/holidays/check/${date}`),
  create: (holiday) => apiCall('/holidays', {
    method: 'POST',
    body: JSON.stringify(holiday),
  }),
  update: (id, holiday) => apiCall(`/holidays/${id}`, {
    method: 'PUT',
    body: JSON.stringify(holiday),
  }),
  delete: (id) => apiCall(`/holidays/${id}`, { method: 'DELETE' }),
  import: (holidays) => apiCall('/holidays/import', {
    method: 'POST',
    body: JSON.stringify({ holidays }),
  }),
};

// Leaves API calls
export const leavesAPI = {
  getAll: (params) => {
    const queryParams = params || {};
    const queryString = new URLSearchParams(queryParams).toString();
    return apiCall(`/leaves/all${queryString ? `?${queryString}` : ''}`);
  },
  review: (id, data) => apiCall(`/leaves/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiCall(`/leaves/${id}`, {
    method: 'DELETE',
  }),
};

// Announcements API calls
export const announcementsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/announcements/all${queryString ? `?${queryString}` : ''}`);
  },
  create: (data) => apiCall('/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiCall(`/announcements/${id}`, {
    method: 'DELETE',
  }),
};

// Salary API calls
export const salaryAPI = {
  getAllEmployees: () => apiCall('/salary/employees'),
  calculate: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/salary/calculate${queryString ? `?${queryString}` : ''}`);
  },
  getSaved: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/salary/saved${queryString ? `?${queryString}` : ''}`);
  },
  updateEmployee: (userId, data) => apiCall(`/salary/employee/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateStatus: (salaryId, data) => apiCall(`/salary/${salaryId}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const employeeApprovalAPI = {
  getPending: () => apiCall('/employees/approval/pending'),
  approve: (employeeId) => apiCall(`/employees/approval/${employeeId}/approve`, {
    method: 'PUT',
  }),
  reject: (employeeId, reason) => apiCall(`/employees/approval/${employeeId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  }),
};

export default {
  dashboardAPI,
  authAPI,
  reportsAPI,
  holidaysAPI,
  leavesAPI,
  announcementsAPI,
  salaryAPI,
  employeeApprovalAPI,
  downloadFile,
  BASE_URL,
};

