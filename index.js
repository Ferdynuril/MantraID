const express = require('express');
const app = express();
const port = process.env.PORT || 8080
const path = require('path');

const session = require("express-session");

app.use(session({
  name: "mantraid.sid",
  secret: "mantraid-super-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 jam
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// View engine setup




app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Get Url
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.admin = req.session.admin || null;
  next();
});

// Routes
const homeRoutes = require('./routes/home');
const imageRoutes = require('./routes/image');
const mangaRoutes = require('./routes/manga');
const update = require('./routes/update');
const authRoutes = require('./routes/auth');

app.use('/admin', authRoutes);
app.use('/update', update);

app.use('/', homeRoutes);
app.use('/image', imageRoutes);
app.use('/Manga', mangaRoutes);





// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong!'
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📁 Views: ./views/`);
  console.log(`🎨 Tailwind CSS: ./public/css/output.css`);
});
