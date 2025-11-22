# 🔄 Real-time Leaves Management System

## ✅ **What's Been Implemented**

### **1️⃣ Socket.io Real-time Events**

#### **Backend Events (`leaveController.js`)**
- ✅ **`leaveCreated`** - Emitted when employee creates a new leave request
- ✅ **`leaveApproved`** - Emitted to specific employee when admin approves
- ✅ **`leaveRejected`** - Emitted to specific employee when admin rejects (with rejection reason)
- ✅ **`leaveReviewed`** - Emitted to all admins when any leave is reviewed

---

### **2️⃣ Mobile App Real-time Updates (`LeavesScreen.tsx`)**

#### **Features:**
✅ **Date Pickers** - Beautiful native date pickers for start/end dates  
✅ **Real-time Approval Notification** - Employee sees approval instantly with alert  
✅ **Real-time Rejection Notification** - Employee sees rejection + reason instantly  
✅ **Automatic Status Update** - Leave status updates in UI without refresh  

#### **Notifications:**
- **Approval**: 
  ```
  🎉 تمت الموافقة!
  تمت الموافقة على طلب الإجازة الخاص بك.
  النوع: مرضية
  المدة: 3 يوم
  ```

- **Rejection**:
  ```
  ❌ تم رفض الطلب
  تم رفض طلب الإجازة الخاص بك.
  
  السبب: لا يوجد رصيد إجازات كافي
  ```

---

### **3️⃣ Admin Panel Real-time Updates (`Leaves.jsx`)**

#### **Features:**
✅ **Live Indicator Badge** - Shows "🔴 مباشر" when connected to Socket.io  
✅ **Real-time New Requests** - New leave requests appear instantly  
✅ **Real-time Review Updates** - Leave status updates automatically  
✅ **Toast Notifications** - Admin gets notified when new leave request arrives  

#### **Notifications:**
- **New Leave Request**:
  ```
  📬 طلب إجازة جديد
  تلقيت طلب إجازة جديد من أحمد حسن
  ```

---

## 🔄 **Complete Real-time Flow**

### **Scenario 1: Employee Requests Leave**
1. **Employee (Mobile)**: Fills form with date pickers → Submits
2. **Backend**: Creates leave → Emits `leaveCreated` event
3. **Admin (Web)**: Sees new request instantly + Gets toast notification ✅
4. **Employee (Mobile)**: Leave appears in "إجازاتي" with status "قيد المراجعة" 🟡

---

### **Scenario 2: Admin Approves Leave**
1. **Admin (Web)**: Reviews leave → Clicks approve ✅
2. **Backend**: Updates leave status → Emits:
   - `leaveApproved` → To specific employee (via user ID room)
   - `leaveReviewed` → To all admins
3. **Employee (Mobile)**: **Gets instant alert** ✅
   ```
   🎉 تمت الموافقة!
   تمت الموافقة على طلب الإجازة الخاص بك.
   ```
4. **Employee (Mobile)**: Leave status changes to "موافق عليها" (green) ✅
5. **Other Admins (Web)**: See status update instantly

---

### **Scenario 3: Admin Rejects Leave**
1. **Admin (Web)**: Reviews leave → Enters rejection reason → Clicks reject ❌
2. **Backend**: Updates leave status → Emits:
   - `leaveRejected` → To specific employee (with rejection reason)
   - `leaveReviewed` → To all admins
3. **Employee (Mobile)**: **Gets instant alert with reason** ❌
   ```
   ❌ تم رفض الطلب
   تم رفض طلب الإجازة الخاص بك.
   
   السبب: يرجى تقديم تقرير طبي
   ```
4. **Employee (Mobile)**: Leave status changes to "مرفوضة" (red) ❌
5. **Employee (Mobile)**: Rejection reason visible in leave card
6. **Other Admins (Web)**: See status update instantly

---

## 📱 **Mobile App Features**

### **Date Pickers**
- **تاريخ البداية**: Tap → Native calendar picker opens
- **تاريخ النهاية**: Tap → Native calendar picker opens
- **Minimum Date**: Can't select past dates
- **Validation**: End date can't be before start date
- **Format**: Automatic `YYYY-MM-DD` formatting

### **Real-time Listeners**
```typescript
onLeaveApproved((leave) => {
  // Update UI
  // Show success alert
});

onLeaveRejected((data) => {
  // Update UI
  // Show rejection alert with reason
});
```

---

## 🖥️ **Admin Panel Features**

### **Live Indicator**
```
إدارة الإجازات الشخصية  [🔴 مباشر]
```
Shows when Socket.io is connected for real-time updates.

### **Real-time Listeners**
```javascript
'leaveCreated': (newLeave) => {
  // Add to list
  // Show toast notification
}

'leaveReviewed': (reviewedLeave) => {
  // Update status
  // Refresh stats
}
```

---

## 🔧 **Technical Implementation**

### **Backend (`leaveController.js`)**
```javascript
import { io } from '../socket/socket.js';

// After leave creation
io.emit('leaveCreated', populatedLeave);

// After approval
io.to(userId.toString()).emit('leaveApproved', populatedLeave);

// After rejection
io.to(userId.toString()).emit('leaveRejected', {
  leave: populatedLeave,
  rejectionReason: rejectionReason
});

// Broadcast to all admins
io.emit('leaveReviewed', populatedLeave);
```

### **Mobile App (`socket.ts`)**
```typescript
export const onLeaveApproved = (callback) => {
  socket?.on('leaveApproved', callback);
};

export const onLeaveRejected = (callback) => {
  socket?.on('leaveRejected', callback);
};
```

### **Admin Panel (`useSocket.js`)**
```javascript
useSocket(onConnect, onDisconnect, {
  'leaveCreated': handleLeaveCreatedRealtime,
  'leaveReviewed': handleLeaveReviewedRealtime,
});
```

---

## 🎯 **Benefits**

✅ **No Page Refresh Needed** - All updates happen instantly  
✅ **Better UX** - Employees know immediately if approved/rejected  
✅ **Clear Communication** - Rejection reasons shown to employees  
✅ **Admin Awareness** - Instant notifications for new requests  
✅ **Multiple Admins** - All admins see updates in real-time  
✅ **Beautiful UI** - Native date pickers, alerts, and badges  

---

## 🧪 **Testing Scenarios**

### **Test 1: New Leave Request**
1. Open mobile app (as employee)
2. Go to "الإجازات" → "إجازاتي"
3. Click "طلب إجازة"
4. Select dates using date pickers
5. Fill reason → Submit
6. ✅ Check admin panel - should see request instantly

### **Test 2: Approval**
1. Admin panel: Review pending leave → Click approve ✅
2. ✅ Check mobile app - should see instant alert + status change to green

### **Test 3: Rejection**
1. Admin panel: Review pending leave → Enter reason → Click reject ❌
2. ✅ Check mobile app - should see instant alert with reason + status change to red

---

## 📝 **Summary**

**Complete real-time leave management system with:**
- 📅 Native date pickers for mobile
- 🔔 Instant approval/rejection notifications
- 🔴 Live updates indicator
- 📬 Admin toast notifications for new requests
- ❌ Rejection reasons displayed to employees
- ✅ All updates happen without page refresh

**All communication is real-time via Socket.io!** 🚀


