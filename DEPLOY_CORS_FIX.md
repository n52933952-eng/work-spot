# Deploy CORS Fix to Render.com

## What Was Fixed

The CORS configuration has been updated to allow requests from:
- `https://work-spot-1.onrender.com` (your production frontend)
- `http://localhost:5173` (local development)
- Any URL set in `CLIENT_URL` environment variable

## Files Changed

1. `backend/index.js` - Updated CORS configuration
2. `backend/socket/socket.js` - Updated Socket.io CORS configuration

## How to Deploy

### Option 1: Automatic Deployment (if connected to Git)

1. **Commit the changes:**
   ```bash
   git add .
   git commit -m "Fix CORS to allow work-spot-1.onrender.com"
   git push
   ```

2. **Render.com will automatically deploy** when you push to your repository

### Option 2: Manual Deployment

1. Go to your Render.com dashboard
2. Select your backend service (`work-spot-6`)
3. Click "Manual Deploy" → "Deploy latest commit"

### Option 3: Set Environment Variable (Alternative)

If you prefer, you can also set the `CLIENT_URL` environment variable on Render.com:

1. Go to your backend service on Render.com
2. Click "Environment" tab
3. Add environment variable:
   - Key: `CLIENT_URL`
   - Value: `https://work-spot-1.onrender.com`
4. Save and wait for redeploy

## Verify Deployment

After deployment, check the logs on Render.com. You should see:
```
🌐 CORS Allowed Origins: [ 'http://localhost:5173', 'https://work-spot-1.onrender.com' ]
```

## Test Login

After deployment, try logging in from `https://work-spot-1.onrender.com`:
- Email: `Yazan` (or `yazan`)
- Password: `Yazan$2004`

The CORS error should be resolved!

