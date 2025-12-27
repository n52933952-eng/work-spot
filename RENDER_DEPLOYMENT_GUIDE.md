# Render.com Deployment Guide

This guide will help you deploy your app to Render.com with your customer's MongoDB database.

## 📋 Prerequisites

- MongoDB connection string from your customer
- Render.com account
- GitHub repository (or connect directly from Git)

## 🔧 Step 1: Prepare Your Code

Your code is already set up correctly! The app uses:
- `MONGO` environment variable for MongoDB connection
- `dotenv` package to load environment variables

## 🌐 Step 2: Deploy to Render.com

### Option A: New Deployment (Recommended for Customer)

1. **Go to Render.com Dashboard**
   - Navigate to https://dashboard.render.com
   - Click "New +" → "Web Service"

2. **Connect Your Repository**
   - Connect your Git repository (GitHub, GitLab, or Bitbucket)
   - Or deploy directly from your local machine

3. **Configure Build Settings**
   - **Name**: Choose a name (e.g., `workspot-production`)
   - **Environment**: Node
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: (leave blank, or set to root)

4. **Set Environment Variables**
   Click "Advanced" → "Add Environment Variable" and add:

   ```
   MONGO=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```
   ⚠️ **IMPORTANT**: Replace with your customer's actual MongoDB connection string!

   ```
   JWT_SCRET=your-secret-jwt-key-here
   ```
   ⚠️ Generate a strong random secret key for JWT tokens

   ```
   PORT=10000
   ```
   (Render automatically sets PORT, but you can set it explicitly)

   ```
   NODE_ENV=production
   ```

   ```
   CLIENT_URL=https://your-frontend-domain.com
   ```
   (Or leave blank for default)

### Option B: Update Existing Deployment

If you already have a deployment on Render.com:

1. **Go to Your Service Dashboard**
   - Navigate to your existing service on Render.com
   - Click on "Environment" tab

2. **Update Environment Variables**
   - Find the `MONGO` variable
   - Click "Edit" and replace with customer's MongoDB URL
   - Make sure all other variables are set correctly
   - Click "Save Changes"

3. **Redeploy**
   - Render will automatically redeploy when you save environment variables
   - Or manually trigger a deployment from the "Manual Deploy" tab

## 🔐 Step 3: Environment Variables Checklist

Make sure these are set in Render.com:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO` | ✅ **YES** | Customer's MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SCRET` | ✅ **YES** | Secret key for JWT tokens | `your-super-secret-key-123` |
| `PORT` | ❌ Optional | Server port (Render sets automatically) | `10000` |
| `NODE_ENV` | ❌ Optional | Environment mode | `production` |
| `CLIENT_URL` | ❌ Optional | Frontend URL for CORS | `https://yourdomain.com` |

## 🎯 Step 4: Verify Deployment

1. **Check Build Logs**
   - Go to your service → "Logs" tab
   - Look for: `✅ MongoDB Connected Successfully`
   - If you see connection errors, check your `MONGO` URL

2. **Test the API**
   - Visit: `https://your-app.onrender.com/api/health`
   - Should return: `{"message": "Server is running", "status": "ok"}`

3. **Check MongoDB Connection**
   - If connected successfully, logs will show: `✅ MongoDB Connected Successfully`
   - If failed, check MongoDB URL format and credentials

## 🐛 Troubleshooting

### MongoDB Connection Failed

**Error**: `MongoDB Connection Error: ...`

**Solutions**:
1. ✅ Verify MongoDB URL is correct in Render.com environment variables
2. ✅ Check if MongoDB IP whitelist allows Render.com IPs (or use `0.0.0.0/0` for all)
3. ✅ Verify MongoDB username/password are correct
4. ✅ Make sure database name is included in connection string
5. ✅ Check MongoDB connection string format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

### Build Failed

**Error**: `npm run build` fails

**Solutions**:
1. ✅ Check that `package.json` has a `build` script
2. ✅ Verify all dependencies are in `package.json`
3. ✅ Check build logs for specific errors

### Server Won't Start

**Error**: Server crashes on start

**Solutions**:
1. ✅ Verify `MONGO` environment variable is set
2. ✅ Check `JWT_SCRET` is set (required for authentication)
3. ✅ Review error logs in Render.com dashboard

## 📝 Important Notes

1. **Never commit `.env` file to Git** - Always use Render.com environment variables
2. **MongoDB Atlas**: If using MongoDB Atlas, make sure to:
   - Add Render.com IPs to whitelist (or allow all: `0.0.0.0/0`)
   - Create a database user with proper permissions
3. **Free Tier**: Render.com free tier services spin down after 15 minutes of inactivity
4. **Environment Variables**: Changes to environment variables trigger automatic redeployment

## 🚀 Next Steps After Deployment

1. **Set up Admin User** (if needed):
   ```bash
   # Run locally with customer's MongoDB URL in .env
   npm run setup:location
   # Or connect to Render.com service and run script
   ```

2. **Update Frontend API URL** (if separate frontend):
   - Update `VITE_API_URL` in frontend `.env` to point to Render.com URL
   - Update `VITE_SOCKET_URL` for Socket.io connections

3. **Test All Features**:
   - Login/Register
   - API endpoints
   - File uploads
   - Real-time features (Socket.io)

## 📞 Support

If you encounter issues:
1. Check Render.com logs first
2. Verify all environment variables are set correctly
3. Test MongoDB connection string locally first

---

**🎉 Your app should now be running on Render.com with your customer's MongoDB database!**

