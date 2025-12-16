# Giphy API Setup Guide

## How to Get Your Free Giphy API Key

1. Go to [Giphy Developers](https://developers.giphy.com/)
2. Click "Create an Account" or "Sign In" if you already have an account
3. Once logged in, click "Create an App"
4. Select "API" as the app type
5. Fill in the required information:
   - App Name: "OpenChattingApp" (or any name you prefer)
   - App Description: "Chat app with GIF support"
6. Click "Create App"
7. Copy your API Key

## Adding the API Key to Your App

1. Open `js/chat.js`
2. Find the line (around line 710):
   ```javascript
   const apiKey = 'your_giphy_api_key_here';
   ```
3. Replace `'your_giphy_api_key_here'` with your actual API key:
   ```javascript
   const apiKey = 'YOUR_ACTUAL_API_KEY';
   ```

## Features

- **Emoji Picker**: Click the 😊 button to open emoji picker
- **GIF Picker**: Click the 🖼️ button to search and send GIFs
- **Search**: Type in the search box to find specific GIFs
- **Trending**: Default view shows trending GIFs

## Note

- Giphy free tier allows 42 requests per hour per IP
- For production apps, consider upgrading to a paid plan
- Without API key, the app will show a demo mode message
