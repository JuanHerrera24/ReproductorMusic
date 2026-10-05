"use strict";
/**
 * ============================================================
 *  DEPLOYMENT SETTINGS
 * ============================================================
 *  YouTube API key shared by every visitor of the deployed site, so the
 *  search works for people who do not have their own key (e.g. a teacher).
 *
 *  Browser keys are visible to anyone, so in Google Cloud Console restrict
 *  this key: Application restrictions → Websites (your Vercel domain) and
 *  API restrictions → YouTube Data API v3.
 *
 *  Leave it empty to make every user type their own key in the page.
 */
const DEFAULT_YOUTUBE_API_KEY = "AIzaSyAHcTJUc0jcu1xtoUDpvv0qJm4MH9Atcik";
