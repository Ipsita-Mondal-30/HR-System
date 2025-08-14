// passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:8080/api/auth/google/callback", 
},
async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 Google OAuth Profile:', {
      id: profile.id,
      displayName: profile.displayName,
      emails: profile.emails,
      name: profile.name
    });

    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      // Check if email exists
      user = await User.findOne({ email: profile.emails[0].value });

      if (user && !user.googleId) {
        user.googleId = profile.id;
        user.lastLogin = new Date();
        await user.save();
      } else if (!user) {
        // Use displayName or fallback to email prefix
        const userName = profile.displayName || 
                       (profile.name && profile.name.givenName + ' ' + profile.name.familyName) ||
                       profile.emails[0].value.split('@')[0];

        console.log('🔐 Creating new user with name:', userName);

        user = await User.create({
          googleId: profile.id,
          name: userName,
          email: profile.emails[0].value,
          role: null, // Let user select after login
          lastLogin: new Date(),
          isActive: true,
          isVerified: false
        });
      }
    } else {
      // Update last login for existing user
      user.lastLogin = new Date();
      await user.save();
    }

    console.log('🔐 User found/created:', user);
    return done(null, user);
  } catch (err) {
    console.error('❌ Passport error:', err);
    return done(err, null);
  }
}));

// These are optional since we're using JWT
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
