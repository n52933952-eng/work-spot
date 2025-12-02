import express from 'express';
import {
  calculateEmployeeSalary,
  getAllEmployeesSalaries,
  updateEmployeeSalary,
  getSavedSalaries,
  updateSalaryStatus
} from '../controllers/salaryController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Get all employees with salary info
router.get('/employees', getAllEmployeesSalaries);

// Calculate salary for employees (saves to database automatically)
router.get('/calculate', calculateEmployeeSalary);

// Get saved salary records
router.get('/saved', getSavedSalaries);

// Update employee salary
router.put('/employee/:userId', updateEmployeeSalary);

// Update salary status (approve, mark as paid)
router.put('/:salaryId/status', updateSalaryStatus);

export default router;

