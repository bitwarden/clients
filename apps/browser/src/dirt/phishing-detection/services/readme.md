# Phishing Detection Local Data

This feature provides a local phishing domains database for offline detection in the browser extension. The local database is loaded as a fallback if the remote database fails to fetch.

The `data` directory contains auto-generated domain lists and metadata.  
Files in this directory are created by the `fetch-phishing-domains.sh` shell script.

The phishing domains data is split into multiple files due to the 5MB file size limit in Firefox extensions.

**Do not edit files in `data` manually; they will be overwritten by the update script.**
