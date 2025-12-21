import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  // Attendance summary
  attendance: {
    totalDays: Number,
    workingDays: Number,
    presentDays: Number,
    absentDays: Number,
    leaveDays: Number,
    holidayDays: Number
  },
  // Hours summary
  hours: {
    totalWorkingHours: Number,
    regularHours: Number,
    overtimeHours: Number
  },
  // Salary calculations
  salary: {
    baseSalary: Number, // Monthly base salary
    dailySalary: Number, // Daily salary (baseSalary / 22)
    hourlySalary: Number, // Hourly salary (dailySalary / 8)
    baseSalaryAmount: Number, // Calculated base (dailySalary × paidDays)
    overtimeSalary: Number, // Overtime pay
    totalSalary: Number // Total salary (baseSalaryAmount + overtimeSalary)
  },
  // Breakdown details
  breakdown: {
    presentDaysSalary: Number,
    leaveDaysSalary: Number,
    holidayDaysSalary: Number,
    absentDaysDeduction: Number,
    paidDays: Number,
    overtimeHours: Number,
    overtimeRate: Number,
    overtimeAmount: Number
  },
  // Status
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid'],
    default: 'calculated'
  },
  // Payment info
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
salarySchema.index({ user: 1, year: 1, month: 1 }, { unique: true });
salarySchema.index({ year: 1, month: 1 });
salarySchema.index({ status: 1 });

const Salary = mongoose.model('Salary', salarySchema);

export default Salary;















