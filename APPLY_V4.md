# Apply Awasar v4 update

Copy the files from this update into your existing `damak-ai-job-hunter` folder and choose **Replace files**.

Then run:

```bat
npm run build
```

If successful:

```bat
git add .
git commit -m "Simplify homepage and salary filters"
git pull --rebase origin main
git push origin main
```

Vercel will redeploy automatically after the push.
