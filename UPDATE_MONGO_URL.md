# How to Update MongoDB URL on Render.com

Since you already deployed to Render.com, you just need to update the `MONGO` environment variable.

## 📝 Step-by-Step Instructions

### Step 1: Go to Your Render Dashboard
1. Open https://dashboard.render.com
2. Log in to your account
3. Find your existing service (the one you deployed last week)

### Step 2: Open Environment Variables
1. Click on your service name
2. Click on the **"Environment"** tab (in the top menu)
3. You'll see a list of all your environment variables

### Step 3: Update MONGO Variable
1. Find the `MONGO` variable in the list
2. Click the **"Edit"** button (or pencil icon) next to it
3. Replace the value with your customer's MongoDB URL
   - Delete the old MongoDB URL
   - Paste the new MongoDB URL from your `.env` file
4. Click **"Save"** or **"Update"**

### Step 4: Wait for Redeployment
- Render.com will **automatically redeploy** your service when you update environment variables
- You'll see a notification that deployment is in progress
- Go to the **"Logs"** tab to watch the deployment

### Step 5: Verify Connection
In the **"Logs"** tab, look for:
- ✅ `✅ MongoDB Connected Successfully` = Everything is working!
- ❌ `MongoDB Connection Error` = Check your MongoDB URL

## ⚠️ Important Notes

1. **No code changes needed** - You only need to update the environment variable
2. **Automatic redeploy** - Render redeploys automatically when you save environment variables
3. **Downtime** - There will be a brief downtime (usually 1-2 minutes) during redeployment
4. **Check MongoDB Access** - Make sure your customer's MongoDB allows connections from Render.com IPs

## 🔍 If You Can't Find MONGO Variable

If you don't see `MONGO` in the environment variables list:
1. Click **"Add Environment Variable"**
2. Key: `MONGO`
3. Value: Your customer's MongoDB URL
4. Click **"Save"**

## 🐛 Troubleshooting

### MongoDB Connection Still Fails?

1. **Check MongoDB URL format**:
   ```
   Correct: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

2. **Check MongoDB Atlas IP Whitelist**:
   - Go to MongoDB Atlas → Network Access
   - Make sure Render.com IPs are allowed
   - Or add `0.0.0.0/0` to allow all IPs (for development/testing)

3. **Check MongoDB Username/Password**:
   - Verify credentials are correct
   - No special characters need URL encoding

4. **Check Database Name**:
   - Make sure database name is correct in connection string

---

**That's it! Your app will now use your customer's MongoDB database instead of yours.**



