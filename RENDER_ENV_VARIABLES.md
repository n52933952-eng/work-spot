# Environment Variables for Render.com

Copy and paste these into Render.com → Your Service → Environment → Add Environment Variable

## Required Variables

```bash
MONGO=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```
Replace with your customer's MongoDB connection string.

```bash
JWT_SCRET=your-super-secret-jwt-key-here
```
Generate a strong random secret (e.g., use: `openssl rand -hex 32`)

## Optional Variables

```bash
NODE_ENV=production
```

```bash
PORT=10000
```
(Usually auto-set by Render, but you can set explicitly)

```bash
CLIENT_URL=https://your-frontend-domain.com
```
(Only if you have a separate frontend domain)

---

## Quick Setup Steps

1. Go to Render.com Dashboard
2. Select your service
3. Click "Environment" tab
4. Add each variable above
5. Replace `MONGO` with customer's MongoDB URL
6. Generate and set `JWT_SCRET`
7. Save and wait for auto-redeploy
8. Check logs for: `✅ MongoDB Connected Successfully`

