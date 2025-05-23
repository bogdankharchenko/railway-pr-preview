# Repository Setup Instructions

This guide will help you push this action to GitHub and create the necessary releases.

## 1. Push to GitHub

```bash
# If you haven't set up the remote yet:
git remote add origin https://github.com/bogdankharchenko/railway-pr-preview.git

# Push the main branch and tags
git push -u origin main
git push --tags
```

## 2. Create a GitHub Release

1. Go to https://github.com/bogdankharchenko/railway-pr-preview/releases
2. Click "Create a new release"
3. Choose tag: `v1.0.0`
4. Release title: `v1.0.0 - Initial Release`
5. Description:
   ```markdown
   ## 🚀 Railway PR Preview Action - Initial Release
   
   Automatically create and manage Railway preview environments for your Pull Requests.
   
   ### Features
   - ✅ Automatic environment lifecycle management
   - ✅ Smart URL discovery and display
   - ✅ Progressive comment updates
   - ✅ Multi-service support
   - ✅ Configurable deployment options
   
   ### Usage
   ```yaml
   - uses: bogdankharchenko/railway-pr-preview@v1.0.0
     with:
       railway_token: ${{ secrets.RAILWAY_TOKEN }}
       source_environment_id: ${{ secrets.RAILWAY_SOURCE_ENV_ID }}
   ```
   
   See the [README](https://github.com/bogdankharchenko/railway-pr-preview#readme) for full documentation.
   ```
6. Click "Publish release"

## 3. Create Major Version Tag

After creating the release, create a `v1` tag that points to the same commit for easier usage:

```bash
git tag -f v1
git push -f origin v1
```

## 4. Test the Action

Now you can use the action in other repositories:

```yaml
- uses: bogdankharchenko/railway-pr-preview@v1
  # or
- uses: bogdankharchenko/railway-pr-preview@v1.0.0
  # or  
- uses: bogdankharchenko/railway-pr-preview@v0.1
```

## 5. Important Files for GitHub Actions

Make sure these files are committed:
- ✅ `action.yml` - Action definition
- ✅ `dist/index.js` - Compiled action code
- ✅ `dist/sourcemap-register.js` - Source map support
- ✅ `README.md` - Documentation

The `dist/` folder **must** be committed for GitHub Actions to work!

## Troubleshooting

### "File not found" Error
- Ensure `dist/` folder is committed (not in .gitignore)
- Verify the tag exists: `git tag -l`
- Check that the tag was pushed: `git ls-remote --tags origin`

### Action Not Found
- Verify repository is public or action has proper permissions
- Check the action reference format: `owner/repo@version`
- Ensure the tag/release exists on GitHub
