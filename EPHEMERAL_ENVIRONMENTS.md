# Ephemeral Environments on Railway

This document explains the different approaches to creating ephemeral environments for Railway PR previews.

## What are Ephemeral Environments?

Ephemeral environments are temporary staging environments that are automatically created for pull requests and destroyed when no longer needed. They provide several benefits:

- **Cost Efficiency**: Automatically cleaned up when PRs are closed
- **Resource Management**: Railway can optimize resource allocation for temporary environments
- **Clear Intent**: Marks environments as temporary previews rather than persistent staging

## Approach 1: Railway's Built-in PR Environments (Recommended)

Railway has native support for ephemeral PR environments that automatically integrates with your GitHub workflow.

### Setup

1. **Enable in Railway Dashboard**:
   - Go to **Project Settings → Environments tab**
   - Enable **"Create PR environments automatically"**
   - Choose your source environment (usually production or staging)

2. **GitHub Integration**:
   - Railway automatically detects PR events from connected GitHub repositories
   - Creates ephemeral environments with names like `pr-123`
   - Automatically deploys your PR branch to the environment
   - Deletes the environment when PR is merged or closed

### Benefits

- ✅ **True Ephemeral Status**: Environments are marked as ephemeral in Railway's system
- ✅ **Automatic Lifecycle**: Created and destroyed automatically by Railway
- ✅ **Zero Configuration**: No GitHub Actions workflow needed
- ✅ **Cost Optimized**: Railway applies ephemeral-specific billing and resource policies
- ✅ **Built-in Integration**: Works seamlessly with Railway's dashboard and tooling

### Configuration

You can customize PR environments using Railway's config-as-code:

```toml
# railway.toml
[environments.pr]
[environments.pr.deploy]
startCommand = "npm run preview"

[environments.pr.build]
buildCommand = "npm run build:preview"
```

## Approach 2: Manual PR Environments with GitHub Actions

Use this repository's action to manually create and manage PR environments.

### Setup

```yaml
name: Railway PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Railway PR Preview
        uses: your-username/railway-pr-preview@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          source_environment_id: ${{ secrets.RAILWAY_SOURCE_ENV_ID }}
          is_ephemeral: true  # Attempts to mark as ephemeral
          comment_on_pr: true
          deploy_on_create: true
```

### Important Notes

- The `is_ephemeral` parameter may not be supported in all Railway API versions
- If not supported, environments are created successfully but may not have ephemeral status internally
- You get more control over the workflow but less integration with Railway's native features

## Comparison

| Feature | Built-in PR Environments | Manual with Actions |
|---------|-------------------------|-------------------|
| **True Ephemeral Status** | ✅ Yes | ❓ API version dependent |
| **Setup Complexity** | ⚡ Very Easy | 🔧 Moderate |
| **Cost Optimization** | ✅ Automatic | ❓ May not apply |
| **Custom Workflows** | ❌ Limited | ✅ Full control |
| **PR Comments** | ❌ Not built-in | ✅ Yes |
| **Multiple Services** | ✅ All services | ✅ All services |
| **Custom Domains** | ✅ Supported | ✅ Supported |

## Recommendation

**For most users**: Use Railway's built-in PR environments (Approach 1) as it provides true ephemeral status and better integration.

**Use manual GitHub Actions (Approach 2) if you need**:
- Custom PR comment formatting
- Integration with other GitHub Actions
- Workflow customization beyond Railway's capabilities
- Support for forked repositories (Railway's built-in doesn't work with forks)

## Migration Guide

### From Manual to Built-in

1. Enable PR environments in Railway Project Settings
2. Remove or disable the GitHub Actions workflow
3. Update any custom domain configurations if needed
4. Test with a new PR to ensure everything works

### From Built-in to Manual

1. Disable automatic PR environments in Railway Project Settings
2. Set up the GitHub Actions workflow from this repository
3. Configure secrets (`RAILWAY_TOKEN`, `RAILWAY_SOURCE_ENV_ID`)
4. Test with a new PR

## Troubleshooting

### Built-in PR Environments

- **PRs not creating environments**: Check that GitHub integration is properly connected
- **Wrong source environment**: Verify the source environment setting in Project Settings
- **Permissions issues**: Ensure the connected GitHub account has proper repository access

### Manual GitHub Actions

- **`is_ephemeral` not working**: This is expected if your Railway API version doesn't support it
- **Environment creation fails**: Check token permissions and source environment ID
- **Comments not appearing**: Verify `GITHUB_TOKEN` permissions

## Testing

You can test the ephemeral environment functionality using the provided test script:

```bash
RAILWAY_TOKEN="your-token" RAILWAY_SOURCE_ENV_ID="your-env-id" node test-ephemeral.js
```

This will test both regular environment creation and the ephemeral parameter (if supported).

## Cost Implications

**Built-in PR environments** automatically benefit from Railway's ephemeral pricing and resource management.

**Manual environments** may or may not benefit from ephemeral optimizations depending on API support and how Railway classifies them internally.

For cost efficiency, built-in PR environments are recommended.
