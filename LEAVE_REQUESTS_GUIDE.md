# 📋 Leave Requests System - Admin Guide

## 🎯 How It Works

### **From Employee (Mobile App)**
1. Employee opens mobile app → **"الإجازات"** tab
2. Switches to **"إجازاتي"** tab
3. Clicks **"طلب إجازة"** (green button)
4. Fills the form:
   - **Type**: Sick (مرضية), Annual (سنوية), Emergency (طارئة), Unpaid (بدون راتب), Half-day (نصف يوم)
   - **Start Date**: e.g., 2025-11-22
   - **End Date**: e.g., 2025-11-24
   - **Reason**: e.g., "مرض - حمى"
5. Submits the request ✅

---

### **To Admin (Web Panel)**
Admin will receive the request in the **admin web panel** at:

**📍 Location**: `http://localhost:5173/leaves`

**📍 Menu**: Sidebar → **"الإجازات الشخصية"** (last item before logout)

---

## 🖥️ Admin Panel - Leaves Page Features

### **1️⃣ Statistics Dashboard**
- **إجمالي الطلبات** (Total requests)
- **قيد المراجعة** (Pending review) - in orange
- **موافق عليها** (Approved) - in green
- **مرفوضة** (Rejected) - in red

---

### **2️⃣ Filters**
- **السنة** (Year): Filter by year
- **الحالة** (Status): Pending, Approved, Rejected, Cancelled
- **النوع** (Type): Annual, Sick, Emergency, Unpaid, Half-day

---

### **3️⃣ Two Tabs**

#### **Tab 1: قيد المراجعة (Pending Review)**
Shows all pending leave requests that need admin approval:
- Employee name + photo + employee number
- Leave type (with color badges)
- Start and end dates
- Number of days
- Reason
- Request date
- **Actions**:
  - ✅ **Approve** (green button)
  - ❌ **Reject** (red button)

#### **Tab 2: تمت المراجعة (Reviewed)**
Shows all reviewed leave requests (approved/rejected):
- Same info as pending
- Status badge
- Reviewer name
- Review date
- Rejection reason (if rejected)

---

### **4️⃣ Review Process**

#### **To Approve:**
1. Click green **✓** button
2. Modal opens showing:
   - Employee details
   - Leave type, duration, dates
   - Reason
3. Click **"موافقة"** to confirm
4. Employee gets notified ✅

#### **To Reject:**
1. Click red **✗** button
2. Modal opens
3. **Required**: Enter rejection reason (e.g., "لا يوجد رصيد إجازات كافي")
4. Click **"رفض"** to confirm
5. Employee sees the rejection + reason in mobile app ❌

---

## 📊 Example Scenario

**Employee Request:**
- **Name**: Ahmad Hassan
- **Type**: Sick Leave (مرضية)
- **Duration**: 3 days (22-24 Nov 2025)
- **Reason**: "مرض - حمى وألم في الحلق"
- **Status**: Pending (قيد المراجعة)

**Admin Actions:**
1. Goes to `/leaves` page
2. Sees the request in **"قيد المراجعة"** tab (highlighted in orange)
3. Reviews the request
4. Either:
   - **Approves** → Status changes to "موافق عليها" (green)
   - **Rejects** → Enters reason "يرجى تقديم تقرير طبي" → Status changes to "مرفوضة" (red)

---

## 🔔 Real-time Updates

- Admin page updates automatically when new requests arrive
- Mobile app updates automatically when admin approves/rejects
- No page refresh needed!

---

## 🌐 API Endpoints Used

### **Mobile App (Employee)**
- `POST /api/leaves` - Submit leave request
- `GET /api/leaves/my` - Get my leave requests
- `DELETE /api/leaves/:id` - Cancel pending request

### **Admin Panel**
- `GET /api/leaves/all` - Get all leave requests (with filters)
- `PUT /api/leaves/:id/review` - Approve or reject a request

---

## ✅ Summary

**Employee submits leave request** → **Admin sees it in web panel at `/leaves`** → **Admin approves/rejects** → **Employee sees update in mobile app**

All leave requests are managed in the **"الإجازات الشخصية"** page, separate from **"العطل"** (company holidays).

---

**Note**: The admin panel is running on `http://localhost:5173` and backend on `http://localhost:5000`.


