const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const healthRoutes = require('./routes/health.routes');
const donorRoutes = require('./routes/donor.routes');
const donationRoutes = require('./routes/donation.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const draftRoutes = require('./routes/draft.routes');
const emailRoutes = require('./routes/email.routes');
const errorMiddleware = require('./middleware/error.middleware');
const { errorResponse } = require('./utils/apiResponse');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/email', emailRoutes);

app.use((req, res) => {
  return errorResponse(res, `Route ${req.originalUrl} not found`, 404);
});

app.use(errorMiddleware);

module.exports = app;
