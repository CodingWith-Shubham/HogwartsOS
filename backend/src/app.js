import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import healthCheckRouter from './routes/heathcheck.routes.js';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import clientRouter from './routes/client.routes.js';
import shootRouter from './routes/shoot.routes.js';
import paymentRouter from './routes/payment.routes.js';
import editingRouter from './routes/editing.routes.js';
import realtimeRouter from './routes/realtime.routes.js';
import attendanceRouter from './routes/attendance.routes.js';
import correctionRouter from './routes/correction.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import upsellRouter from './routes/upsell.routes.js';
import upsellCrossSellRouter from './routes/upsellCrossSell.routes.js';
import clientProfileRouter from './routes/clientProfile.routes.js';
import notificationRouter from './routes/notification.routes.js';
import marketingRouter from './routes/marketing.routes.js';
import financeRouter from './routes/finance.routes.js';
import expenseRouter from './routes/expense.routes.js';
import salesTargetRouter from './routes/salesTarget.routes.js';

import errorHandler from './utils/error-handler.js';
import { ApiError } from './utils/api-error.js';

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static('public'));
app.use(cookieParser());

app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Route Mounting
app.use('/api/v1/healthcheck', healthCheckRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/client-profiles', clientProfileRouter);
app.use('/api/v1/shoots', shootRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/editing', editingRouter);
app.use('/api/v1/realtime-data', realtimeRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/corrections', correctionRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1', upsellRouter);
app.use('/api/v1/upsell-crosssell', upsellCrossSellRouter); // Upsell & Cross-Sell pipeline (separate from leads)
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/marketing', marketingRouter);
app.use('/api/v1/finance', financeRouter);
app.use('/api/v1/expenses', expenseRouter);
app.use('/api/v1/sales-targets', salesTargetRouter);

app.get('/', (req, res) => {
    res.json({ message: 'Hogwarts Studio CRM Backend API Running' });
});

app.use((req, res, next) => {
    next(new ApiError(404, "Route not found"));
});

app.use(errorHandler);

// Hogwarts Studio CRM Express Backend API (Refreshed)
export default app;