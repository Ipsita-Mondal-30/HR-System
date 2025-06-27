const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config(); // ✅ Moved to top

const employeeRoutes = require('./routes/employeeRoutes');

const app = express();

app.use((req, res, next) => {
  console.log(`🛰️ Incoming Request: ${req.method} ${req.url}`);
  next();
});


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/employees', employeeRoutes);


app.get('/health', (req, res) => res.send('API is running 🚀'));

// Connect to DB
const PORT = process.env.PORT || 8080;
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => console.log(err));
