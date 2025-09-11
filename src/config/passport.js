// passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const mongoose = require('mongoose');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${BASE_URL}/api/auth/google/callback`,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 Google OAuth Profile:', {
      id: profile.id,
      displayName: profile.displayName,
      emails: profile.emails,
      name: profile.name
    });

    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, attempting to connect...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Database connected for OAuth');
    }

    const email = profile.emails[0].value.toLowerCase();
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      // Check if email exists
      user = await User.findOne({ email: email });

      if (user && !user.googleId) {
        // Link existing user with Google account
        console.log('🔗 Linking existing user with Google account');
        user.googleId = profile.id;
        user.lastLogin = new Date();
        await user.save();
        console.log('✅ User linked successfully');
      } else if (!user) {
        // Create new user
        const userName = profile.displayName || 
                       (profile.name && `${profile.name.givenName} ${profile.name.familyName}`) ||
                       email.split('@')[0];

        console.log('🔐 Creating new user with name:', userName);

        try {
          user = await User.create({
            googleId: profile.id,
            name: userName,
            email: email,
            role: null, // Let user select after login
            lastLogin: new Date(),
            isActive: true,
            isVerified: false
          });
          console.log('✅ New user created successfully:', user._id);
        } catch (createError) {
          console.error('❌ Error creating user:', createError);
          
          // If it's a duplicate key error, try to find the existing user
          if (createError.code === 11000) {
            console.log('🔍 Duplicate key error, searching for existing user...');
            
            // Check if the error is related to a duplicate _id
            if (createError.keyPattern && createError.keyPattern._id) {
              console.log('⚠️ Duplicate _id detected, attempting to find user by ID');
              const idValue = createError.keyValue._id;
              user = await User.findById(idValue);
              
              if (user) {
                console.log('✅ Found user with duplicate _id, updating instead of creating');
                // Update the user instead of creating a new one
                if (!user.googleId) {
                  user.googleId = profile.id;
                }
                user.lastLogin = new Date();
                await user.save();
                return done(null, user);
              }
            }
            
            // Try to find by email or googleId
            user = await User.findOne({ 
              $or: [
                { email: email },
                { googleId: profile.id }
              ]
            });
            
            if (user) {
              console.log('✅ Found existing user, updating Google ID');
              user.googleId = profile.id;
              user.lastLogin = new Date();
              await user.save();
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }
    } else {
      // Update last login for existing user
      console.log('👤 Existing Google user found, updating last login');
      user.lastLogin = new Date();
      await user.save();
    }

    console.log('🔐 OAuth successful for user:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    return done(null, user);
  } catch (err) {
    console.error('❌ Passport OAuth error:', err);
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
