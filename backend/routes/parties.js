import express from 'express';
import {
  getParties,
  getPartyById,
  createParty,
  updateParty,
  deleteParty,
} from '../controllers/partyController.js';

const router = express.Router();

router.route('/')
  .get(getParties)
  .post(createParty);

router.route('/:id')
  .get(getPartyById)
  .put(updateParty)
  .delete(deleteParty);

export default router;
