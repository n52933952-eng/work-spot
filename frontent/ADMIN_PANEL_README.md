# 🎯 Admin Panel - نظام إدارة الحضور

لوحة التحكم الإدارية لنظام إدارة حضور الموظفين

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd D:\workspot\frontent
npm install
```

### 2. Install Additional Libraries (if needed)

```bash
npm install axios jspdf jspdf-autotable recharts react-leaflet leaflet
```

### 3. Run Development Server

```bash
npm run dev
```

The admin panel will be available at: `http://localhost:5173`

---

## 🔐 Login Credentials

- **Username:** `admin`
- **Password:** `admin`

---

## 📊 Features

### 1. **لوحة الموظفين (Dashboard)**
- عرض إحصائيات اليوم:
  - ✅ الموظفون الحاضرون
  - ⏰ الموظفون المتأخرون
  - ❌ الموظفون الغائبون
- جداول تفصيلية لكل فئة
- خريطة مواقع تسجيل الحضور (قيد التطوير)

### 2. **التقارير (Reports)**
- **تقرير الحضور الشهري:**
  - تصفية حسب الشهر والسنة والموظف
  - تحميل PDF
  
- **تقرير التأخيرات:**
  - تصفية حسب الفترة الزمنية
  - تفاصيل دقائق التأخير لكل موظف
  
- **تقرير العمل الإضافي:**
  - حساب ساعات العمل الإضافية
  - تصفية شهرية

### 3. **نظام النقاط (Points System)**
- لوحة المتصدرين (Leaderboard)
- قواعد النقاط:
  - +10 نقاط: حضور في الوقت
  - +20 نقطة: شهر كامل بدون تأخير
  - +5 نقاط: أسبوع متواصل
- عرض سلسلة أيام الحضور (Streak)

### 4. **إدارة العطل (Holidays Management)**
- ➕ إضافة عطلة جديدة
- ✏️ تعديل عطلة موجودة
- 🗑️ حذف عطلة
- تحديد:
  - اسم العطلة
  - تاريخ البداية والنهاية
  - تطبيق على جميع الموظفين أو فروع محددة
  - تفعيل/تعطيل العطلة
- 📤 استيراد العطل من CSV (قيد التطوير)
- 📅 عرض التقويم السنوي (قيد التطوير)

---

## 🏗️ Project Structure

```
src/
├── components/
│   └── Layout/
│       ├── MainLayout.jsx       # Layout الرئيسي
│       └── Sidebar.jsx          # القائمة الجانبية
│
├── pages/
│   ├── Login.jsx                # صفحة تسجيل الدخول
│   ├── Dashboard.jsx            # لوحة الموظفين
│   ├── Reports.jsx              # صفحة التقارير
│   ├── Points.jsx               # نظام النقاط
│   └── Holidays.jsx             # إدارة العطل
│
├── App.jsx                      # Routing الرئيسي
└── main.jsx                     # Entry Point
```

---

## 🔧 Tech Stack

- **React 19** - UI Framework
- **Vite** - Build Tool
- **Chakra UI** - UI Component Library
- **React Router DOM** - Routing
- **React Icons** - Icons
- **date-fns** - Date utilities

### To Be Added:
- **axios** - API calls
- **jsPDF** - PDF generation
- **recharts** - Charts/Graphs
- **react-leaflet** - Maps

---

## 🔌 API Integration

Currently, the admin panel uses **mock data**. To connect to the backend:

### 1. Create API Service

Create `src/services/api.js`:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 2. Update Pages

Replace mock data with API calls:

```javascript
// Example: Dashboard.jsx
import api from '../services/api';

const fetchDashboardData = async () => {
  try {
    const { data } = await api.get('/dashboard/today');
    setStats(data.stats);
    setEmployees(data.employees);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🎨 Customization

### Colors

The admin panel uses Chakra UI's theme system. Main colors:

- Primary: `blue.600`
- Success: `green.500`
- Warning: `orange.500`
- Danger: `red.500`

### Modify in `main.jsx`:

```javascript
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#...', 
      // ... custom colors
    },
  },
});

<ChakraProvider theme={theme}>
```

---

## 📝 TODO: Backend API Endpoints

The admin panel expects these API endpoints:

### Dashboard
- `GET /api/dashboard/today` - Get today's stats and employees

### Reports
- `POST /api/reports/attendance` - Generate attendance PDF
- `POST /api/reports/late` - Generate late report PDF
- `POST /api/reports/overtime` - Generate overtime PDF

### Points
- `GET /api/points/leaderboard` - Get employee points leaderboard

### Holidays
- `GET /api/holidays` - Get all holidays
- `POST /api/holidays` - Create new holiday
- `PUT /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday

### Employees
- `GET /api/users/employees` - Get all employees

---

## 🚀 Next Steps

1. **Install Additional Dependencies:**
   ```bash
   npm install axios jspdf jspdf-autotable recharts react-leaflet leaflet
   ```

2. **Create API Service** (`src/services/api.js`)

3. **Update Backend:**
   - Add admin authentication endpoint
   - Create dashboard API endpoint
   - Implement PDF generation endpoints

4. **Add Maps:**
   - Install `react-leaflet` and `leaflet`
   - Create map component
   - Show employee check-in locations

5. **Add Charts:**
   - Install `recharts`
   - Add attendance trends charts
   - Add performance graphs

6. **Implement CSV Import:**
   - Add file upload handling
   - Parse CSV for holidays
   - Bulk insert to database

---

## 🐛 Known Issues / TODOs

- [ ] Map component (showing check-in locations)
- [ ] Calendar view for holidays
- [ ] CSV import functionality
- [ ] PDF generation (currently shows toast only)
- [ ] Real-time updates (Socket.io)
- [ ] Employee management (add/edit/delete)
- [ ] Advanced filtering and search
- [ ] Export reports to Excel
- [ ] Dark mode support

---

## 📞 Support

For issues or questions, contact the development team.

---

## 📄 License

Internal use only - Property of [Company Name]





