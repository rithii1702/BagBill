import express from 'express';
import {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  getNextInvoiceNumber,
  recordPayment,
} from '../controllers/billController.js';

const router = express.Router();

router.get('/next-number', getNextInvoiceNumber);

router.route('/')
  .get(getBills)
  .post(createBill);

router.post('/:id/payments', recordPayment);

router.route('/:id')
  .get(getBillById)
  .put(updateBill)
  .delete(deleteBill);

export default router;
