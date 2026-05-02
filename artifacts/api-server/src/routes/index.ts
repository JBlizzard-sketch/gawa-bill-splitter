import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import participantsRouter from "./participants";
import itemsRouter from "./items";
import paymentsRouter from "./payments";
import tripsRouter from "./trips";
import recurringRouter from "./recurring";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(participantsRouter);
router.use(itemsRouter);
router.use(paymentsRouter);
router.use(tripsRouter);
router.use(recurringRouter);
router.use(dashboardRouter);

export default router;
