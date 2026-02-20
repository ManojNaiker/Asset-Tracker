# SAML SSO Integration Guide

This project implements SAML 2.0 Single Sign-On (SSO) using `passport-saml`. This guide explains how to integrate a similar SSO flow into your other web applications.

## Prerequisites

- **Identity Provider (IdP):** You need a SAML IdP (e.g., Okta, Azure AD, Google Workspace).
- **Service Provider (SP) Metadata:** Your app will act as the SP.

## 1. Required Dependencies

Install the following packages:
```bash
npm install passport @node-saml/passport-saml express-session
```

## 2. Server-Side Implementation (Express)

### Configuration
Configure the `SamlStrategy` with settings from your IdP:

```javascript
import passport from 'passport';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';

const samlStrategy = new SamlStrategy(
  {
    // URL provided by your IdP
    entryPoint: 'https://your-idp.com/saml/login',
    // Unique identifier for your application (SP)
    issuer: 'your-app-issuer-id',
    // Your app's callback URL where IdP sends responses
    callbackUrl: 'https://your-app.com/api/auth/saml/callback',
    // IdP's Public Certificate (for verifying signatures)
    idpCert: '---BEGIN CERTIFICATE--- ... ---END CERTIFICATE---',
    // Optional: Logout URL
    logoutUrl: 'https://your-idp.com/saml/logout',
  },
  (profile, done) => {
    // Map SAML profile attributes to your user model
    const user = {
      email: profile.email || profile.nameID,
      firstName: profile.firstName,
      lastName: profile.lastName
    };
    return done(null, user);
  }
);

passport.use('saml', samlStrategy);
```

### Routes

Register the necessary authentication routes:

```javascript
// 1. Initiate Login
app.get('/api/auth/saml/login', passport.authenticate('saml'));

// 2. Consume SAML Assertion (Callback)
app.post(
  '/api/auth/saml/callback',
  passport.authenticate('saml', { failureRedirect: '/login', failureFlash: true }),
  (req, res) => {
    res.redirect('/');
  }
);

// 3. SP Metadata (To be shared with IdP)
app.get('/api/auth/saml/metadata', (req, res) => {
  res.type('application/xml');
  res.send(samlStrategy.generateServiceProviderMetadata(decryptionCert));
});
```

## 3. Security Considerations

1.  **Certificate Management:** Always store certificates securely (e.g., environment variables or secrets).
2.  **Signature Verification:** Ensure `wantAssertionsSigned` is set to `true` (default in newer versions).
3.  **Clock Skew:** Handle minor time differences between SP and IdP using `acceptedClockSkewMs`.
4.  **JIT Provisioning:** Decide if you want to create users on-the-fly (Just-In-Time) when they first log in via SSO.

## 4. Testing

Use the `/api/auth/saml/metadata` endpoint to get the XML metadata required by your Identity Provider to establish the trust relationship.
