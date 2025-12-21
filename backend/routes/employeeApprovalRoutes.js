import express from 'express';
import {
  getPendingEmployees,
  approveEmployee,
  rejectEmployee
} from '../controllers/employeeApprovalController.js';
import protectRoute from '../midlewar/protectRoute.js';

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Get all pending employees
router.get('/pending', getPendingEmployees);

// Approve an employee
router.put('/:employeeId/approve', approveEmployee);

// Reject an employee
router.put('/:employeeId/reject', rejectEmployee);

export default router;















