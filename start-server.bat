@echo off
echo Starting local development server for Habit Tracker...
echo.
echo Please ensure you have Node.js installed.
echo If this is your first time running this, it may take a moment to download 'serve'.
echo.
echo Once the server is running, please visit:
echo http://localhost:3000
echo.
echo IMPORTANT: Make sure to add 'http://localhost:3000/views/password_reset.html' 
echo to your Supabase Redirect URLs in the dashboard.
echo.
npx serve -l 3000
pause
