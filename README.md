# Railway PR Preview Action

🚀 Automatically create and manage Railway preview environments for your Pull Requests.

This GitHub Action integrates with Railway's API to:
- **Create** preview environments when PRs are opened
- **Update** environments when PRs are synchronized  
- **Delete** environments when PRs are closed or merged
- **Comment** on PRs with deployment URLs and status

## Features

- ✅ Automatic environment lifecycle management
- ✅ Clones configuration from source environment
- ✅ Supports custom environment naming
- ✅ Posts deployment URLs in PR comments
- ✅ Handles PR reopening and synchronization
- ✅ Clean environment deletion on PR close
- ✅ Configurable deployment triggering
- ✅ **Ephemeral environment support** for cost-effective temporary previews

## Usage

### Basic Setup

Create `.github/workflows/railway-preview.yml`:

```yaml
name: Railway PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Railway PR Preview
        uses: bogdankharchenko/railway-pr-preview@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          source_environment_id: ${{ secrets.RAILWAY_SOURCE_ENV_ID }}
```

### Advanced Configuration

```yaml
name: Railway PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
  push:
    branches: [ feature/* ]  # Optional: deploy on push to feature branches

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Railway PR Preview
        uses: bogdankharchenko/railway-pr-preview@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          source_environment_id: ${{ secrets.RAILWAY_SOURCE_ENV_ID }}
          environment_name_prefix: 'preview-'
          comment_on_pr: 'true'
          deploy_on_create: 'true'
          is_ephemeral: 'true'  # Create as ephemeral environment for cost optimization
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Railway Ephemeral Environments

Railway has built-in support for ephemeral PR environments. Here are the two approaches you can use:

### Option 1: Railway's Built-in PR Environments (Recommended)

Enable automatic PR environments in your Railway project:

1. Go to **Project Settings → Environments tab** in Railway dashboard
2. Enable **"Create PR environments automatically"**
3. Railway will automatically create ephemeral environments for each PR
4. These environments are automatically marked as ephemeral and deleted when PRs close

**Workflow with built-in PR environments:**
```yaml
# No additional action needed - Railway handles this automatically
# when PR environments are enabled in project settings
```

### Option 2: Manual PR Environments with this Action

Use this action to manually create PR environments with the option to mark them as ephemeral:

```yaml
- name: Deploy Railway PR Preview  
  uses: your-username/railway-pr-preview@v1
  with:
    railway_token: ${{ secrets.RAILWAY_TOKEN }}
    source_environment_id: ${{ secrets.RAILWAY_SOURCE_ENV_ID }}
    is_ephemeral: true  # Attempts to mark as ephemeral (may not be supported in all Railway API versions)
    comment_on_pr: true
    deploy_on_create: true
```

**Note**: The `is_ephemeral` parameter may not be supported in all Railway API versions. If it's not supported, the environment will still be created successfully but may not be marked as ephemeral internally. Railway's built-in PR environment feature (Option 1) is the recommended approach for true ephemeral environments.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `railway_token` | Railway API token (Account token recommended) | ✅ | - |
| `source_environment_id` | Environment ID to clone from (typically production) | ✅ | - |
| `github_token` | GitHub token for posting comments and status checks | ❌ | `${{ github.token }}` |
| `environment_name_prefix` | Prefix for environment names | ❌ | `pr-` |
| `comment_on_pr` | Whether to comment on the PR with environment info | ❌ | `true` |
| `deploy_on_create` | Whether to trigger deployment after creating environment | ❌ | `true` |
| `wait_for_urls` | Whether to wait for deployment URLs before updating comment | ❌ | `true` |
| `url_wait_timeout` | Max time to wait for URLs in seconds | ❌ | `120` |
| `is_ephemeral` | Whether to create the environment as ephemeral (temporary preview) | ❌ | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `environment_id` | ID of the created/managed environment |
| `environment_name` | Name of the created/managed environment |
| `deployment_url` | URL of the deployed environment (if available) |
| `skipped` | Set to 'true' if preview was skipped due to missing credentials |

## Setup Instructions

### 1. Get Railway API Token

1. Go to [Railway Tokens](https://railway.com/account/tokens)
2. Create a new **Account Token** (recommended) or **Team Token**
3. Copy the token value

### 2. Get Source Environment ID

1. Open your Railway project dashboard
2. Navigate to the environment you want to clone from (usually production)
3. Copy the environment ID from the URL or environment settings

### 3. Configure GitHub Secrets

Add these secrets to your repository settings:

- `RAILWAY_TOKEN` - Your Railway API token
- `RAILWAY_SOURCE_ENV_ID` - Source environment ID to clone from

### 4. Add Workflow File

Create `.github/workflows/railway-preview.yml` with the configuration above.

## How It Works

### PR Opened/Synchronized
1. Creates a new Railway environment named `pr-{number}` (configurable)
2. Clones configuration from the source environment
3. Optionally triggers deployment
4. **Posts initial comment** with "Creating..." status
5. **Waits for deployment URLs** to become available (up to 2 minutes by default)
6. **Updates comment** with live deployment URLs and status

### PR Closed/Merged
1. Finds the associated environment by name
2. Deletes the environment to clean up resources
3. Updates the PR comment to reflect deletion

## URL Discovery & Display

The action provides enhanced URL discovery with these features:

### Smart URL Detection
- **Service Domains** - Railway-generated subdomains (*.up.railway.app)
- **Custom Domains** - Your configured custom domains  
- **Multiple Services** - Handles projects with multiple services
- **URL Types** - Distinguishes between service, custom, static, and deployment URLs

### Progressive Comment Updates
1. **Initial Comment** - Posted immediately with "Creating..." status
2. **URL Discovery** - Waits up to 2 minutes for deployment URLs
3. **Final Update** - Comment updated with live URLs and ready status

### Comment Format Example
```markdown
## 🚀 Railway Preview Environment Ready

**Environment:** pr-123
**Environment ID:** `env-abc123`
**Status:** ✅ Ready

**🔗 Deployment URLs:**

**Frontend:**
- [frontend-pr-123.up.railway.app](https://frontend-pr-123.up.railway.app)
- [preview.myapp.com](https://preview.myapp.com) (Custom Domain)

**API:**
- [api-pr-123.up.railway.app](https://api-pr-123.up.railway.app)
```

### Configuration Options
- `wait_for_urls: 'false'` - Skip URL waiting for faster comments
- `url_wait_timeout: '180'` - Custom timeout in seconds

## Permissions

The action requires:
- **Railway**: Account or Team token with project access
- **GitHub**: Default `GITHUB_TOKEN` permissions for commenting

## Troubleshooting

### Common Issues

**Environment creation fails:**
- Verify Railway token has correct permissions
- Check source environment ID is correct
- Ensure source environment exists and is accessible

**Comments not appearing:**
- Verify `GITHUB_TOKEN` permissions
- Check if `comment_on_pr` is enabled

**Deployment not triggering:**
- Ensure `deploy_on_create` is `true`
- Verify deployment triggers are configured in Railway

### Debug Mode

Add this to your workflow for verbose logging:

```yaml
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with a real Railway project
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Railway Documentation](https://docs.railway.com)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Issues](https://github.com/bogdankharchenko/railway-pr-preview/issues)
