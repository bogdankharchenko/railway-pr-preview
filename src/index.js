const core = require('@actions/core');
const github = require('@actions/github');
const RailwayClient = require('./railway-client');

async function run() {
  try {
    // Get inputs
    const railwayToken = core.getInput('railway_token');
    const sourceEnvironmentId = core.getInput('source_environment_id');
    
    // Check if required secrets are available
    if (!railwayToken || !sourceEnvironmentId) {
      core.warning('Railway credentials not available. Skipping preview deployment.');
      core.warning('This is normal for forked repositories due to security restrictions.');
      core.setOutput('skipped', 'true');
      return;
    }
    const githubToken = core.getInput('github_token');
    const environmentNamePrefix = core.getInput('environment_name_prefix') || 'pr-';
    const commentOnPr = core.getInput('comment_on_pr') === 'true';
    const deployOnCreate = core.getInput('deploy_on_create') === 'true';
    const waitForUrls = core.getInput('wait_for_urls') === 'true';
    const urlWaitTimeout = parseInt(core.getInput('url_wait_timeout') || '120', 10) * 1000;

    // Initialize clients
    const railway = new RailwayClient(railwayToken);
    const octokit = githubToken ? github.getOctokit(githubToken) : null;

    // Get project ID from source environment
    core.info('Getting project information from source environment...');
    let sourceEnv;
    try {
      sourceEnv = await railway.getEnvironment(sourceEnvironmentId);
    } catch (sourceError) {
      core.error(`Failed to get source environment: ${sourceError.message}`);
      throw new Error(`Source environment not found or inaccessible. Please verify the environment ID and token permissions.`);
    }
    
    if (!sourceEnv) {
      throw new Error(`Source environment not found. Please verify the environment configuration.`);
    }
    const projectId = sourceEnv.projectId;
    core.info(`Project: ${sourceEnv.name} environment`);

    const { context } = github;
    const { eventName, payload } = context;

    core.info(`Event: ${eventName}`);
    core.info(`Action: ${payload.action}`);

    let prNumber;
    let branchName;
    let repositoryName;

    // Handle different event types
    if (eventName === 'pull_request' || eventName === 'pull_request_target') {
      prNumber = payload.pull_request.number;
      branchName = payload.pull_request.head.ref;
      repositoryName = payload.repository.name;
    } else if (eventName === 'push') {
      // Handle push events to PR branches
      const ref = payload.ref;
      if (ref.startsWith('refs/heads/')) {
        branchName = ref.replace('refs/heads/', '');
        repositoryName = payload.repository.name;
        // Try to find associated PR
        if (octokit) {
          const { data: prs } = await octokit.rest.pulls.list({
            owner: context.repo.owner,
            repo: context.repo.repo,
            head: `${context.repo.owner}:${branchName}`,
            state: 'open'
          });
          if (prs.length > 0) {
            prNumber = prs[0].number;
          }
        }
      } else {
        core.info('Push event not for a branch, skipping');
        return;
      }
    } else {
      core.info(`Unsupported event type: ${eventName}`);
      return;
    }

    const environmentName = `${environmentNamePrefix}${prNumber || branchName}`;
    core.info(`Environment name: ${environmentName}`);

    // Handle different actions
    if (eventName === 'pull_request' || eventName === 'pull_request_target') {
      const action = payload.action;

      if (action === 'opened' || action === 'synchronize' || action === 'reopened') {
        await handlePROpenedOrUpdated(railway, octokit, {
          projectId,
          sourceEnvironmentId,
          sourceEnv,
          environmentName,
          prNumber,
          branchName,
          repositoryName,
          commentOnPr,
          deployOnCreate,
          waitForUrls,
          urlWaitTimeout,
          context
        });
      } else if (action === 'closed') {
        await handlePRClosed(railway, octokit, {
          projectId,
          environmentName,
          prNumber,
          context
        });
      }
    } else if (eventName === 'push' && prNumber) {
      // Handle push to PR branch (synchronize equivalent)
      await handlePROpenedOrUpdated(railway, octokit, {
        projectId,
        sourceEnvironmentId,
        sourceEnv,
        environmentName,
        prNumber,
        branchName,
        repositoryName,
        commentOnPr,
        deployOnCreate,
        waitForUrls,
        urlWaitTimeout,
        context
      });
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    core.error(error.stack);
  }
}

async function handlePROpenedOrUpdated(railway, octokit, options) {
  const {
    projectId,
    sourceEnvironmentId,
    sourceEnv,
    environmentName,
    prNumber,
    branchName,
    repositoryName,
    commentOnPr,
    deployOnCreate,
    waitForUrls,
    urlWaitTimeout,
    context
  } = options;

  core.info(`Handling PR opened/updated for PR #${prNumber}`);
  core.info(`Environment name: ${environmentName}`);
  core.info(`Project: ${sourceEnv.name} environment`);
  core.info(`Source Environment: ${sourceEnv.name}`);

  try {
    // Check if environment already exists
    core.info('Checking for existing environment...');
    let environment = await railway.findEnvironmentByName(projectId, environmentName);
    let isNewEnvironment = false;

    if (environment) {
      core.info(`Environment already exists: ${environment.name}`);
      core.info('Using existing environment - will redeploy to get latest changes');
    } else {
      // Create new environment only if it doesn't exist
      core.info(`Creating new environment: ${environmentName}`);
      core.info(`Using source environment: ${sourceEnv.name}`);
      
      try {
        environment = await railway.createEnvironment(projectId, sourceEnvironmentId, environmentName);
        core.info(`Environment created successfully: ${environment.name}`);
        isNewEnvironment = true;
      } catch (createError) {
        core.error(`Failed to create environment: ${createError.message}`);
        throw createError;
      }
    }

    // Post initial comment if it's a new environment
    if (commentOnPr && octokit && prNumber && isNewEnvironment) {
      await postPRComment(octokit, context, prNumber, {
        environment,
        urls: [],
        action: 'creating',
        isInitial: true
      });
    }

    // Deploy the environment (either newly created or existing)
    if (deployOnCreate) {
      const deployAction = isNewEnvironment ? 'Triggering initial deployment' : 'Redeploying with latest changes';
      core.info(`${deployAction}...`);
      try {
        const deploySuccess = await railway.deployEnvironment(environment.id);
        if (deploySuccess) {
          core.info('Deployment triggered successfully');
        } else {
          core.warning('Deployment could not be triggered automatically - may need manual trigger');
        }
      } catch (deployError) {
        core.warning(`Deployment trigger failed: ${deployError.message}`);
        core.warning('Environment ready but deployment must be triggered manually');
      }
    }

    // Wait for URLs to become available and update comment
    if (waitForUrls) {
      core.info('Waiting for deployment URLs...');
      const { environment: updatedEnv, urls } = await railway.waitForDeploymentUrls(environment.id, urlWaitTimeout);
      
      // Set outputs
      core.setOutput('environment_id', updatedEnv.id);
      core.setOutput('environment_name', updatedEnv.name);
      if (urls.length > 0) {
        core.setOutput('deployment_url', urls[0].url);
      }

      // Update comment with URLs (or create if not posted initially)
      if (commentOnPr && octokit && prNumber) {
        await postPRComment(octokit, context, prNumber, {
          environment: updatedEnv,
          urls,
          action: isNewEnvironment ? 'created' : 'updated'
        });
      }

      core.info(`Environment ready: ${updatedEnv.name}`);
      if (urls.length > 0) {
        core.info(`Deployment URLs: ${urls.map(u => u.url).join(', ')}`);
      } else {
        core.warning('No deployment URLs found after waiting');
      }
    } else {
      // Don't wait for URLs, just set basic outputs and update comment
      core.setOutput('environment_id', environment.id);
      core.setOutput('environment_name', environment.name);

      if (commentOnPr && octokit && prNumber) {
        await postPRComment(octokit, context, prNumber, {
          environment,
          urls: [],
          action: isNewEnvironment ? 'created' : 'updated'
        });
      }
    }

  } catch (error) {
    core.error(`Failed to handle PR opened/updated: ${error.message}`);
    throw error;
  }
}

async function handlePRClosed(railway, octokit, options) {
  const { projectId, environmentName, prNumber, context } = options;

  core.info(`Handling PR closed for PR #${prNumber}`);

  try {
    // Find and delete the environment
    const environment = await railway.findEnvironmentByName(projectId, environmentName);
    
    if (environment) {
      core.info(`Deleting environment: ${environment.name}`);
      await railway.deleteEnvironment(environment.id);
      core.info('Environment deleted successfully');

      // Comment on PR if requested
      if (octokit && prNumber) {
        await postPRComment(octokit, context, prNumber, {
          environment,
          action: 'deleted'
        });
      }
    } else {
      core.info(`Environment not found: ${environmentName}`);
    }

  } catch (error) {
    core.error(`Failed to handle PR closed: ${error.message}`);
    // Don't throw error for cleanup operations to avoid failing the workflow
  }
}

async function postPRComment(octokit, context, prNumber, data) {
  const { environment, urls = [], action, isInitial = false } = data;

  let commentBody;

  if (action === 'deleted') {
    commentBody = `## 🗑️ Railway Preview Environment Deleted

The preview environment **${environment.name}** has been deleted as the PR was closed.`;
  } else if (action === 'creating' && isInitial) {
    commentBody = `## 🚀 Railway Preview Environment Creating

**Environment:** ${environment.name}
**Status:** 🔄 Creating and deploying...

*Deployment URLs will appear here once the build completes (usually takes 1-2 minutes).*

---
*This comment will be automatically updated with deployment URLs.*`;
  } else {
    const urlsSection = formatUrlsSection(urls);
    const statusEmoji = urls.length > 0 ? '✅' : '🔄';
    const statusText = urls.length > 0 ? 'Ready' : 'Deploying...';

    commentBody = `## 🚀 Railway Preview Environment ${action === 'created' ? 'Ready' : 'Updated'}

**Environment:** ${environment.name}
**Status:** ${statusEmoji} ${statusText}${urlsSection}

---
*This comment is automatically updated when the PR is synchronized.*`;
  }

  try {
    // Look for existing comment to update
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
    });

    const existingComment = comments.find(comment => 
      comment.body.includes('Railway Preview Environment') && 
      comment.user.type === 'Bot'
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
      core.info('Updated existing PR comment');
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: commentBody,
      });
      core.info('Created new PR comment');
    }
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error.message}`);
  }
}

function formatUrlsSection(urls) {
  if (urls.length === 0) {
    return '\n\n*🔄 Deployment URLs will appear here once the build completes...*';
  }

  const urlsByService = urls.reduce((acc, urlInfo) => {
    const serviceName = urlInfo.serviceName || 'Service';
    if (!acc[serviceName]) {
      acc[serviceName] = [];
    }
    acc[serviceName].push(urlInfo);
    return acc;
  }, {});

  let urlsSection = '\n\n**🔗 Deployment URLs:**';
  
  for (const [serviceName, serviceUrls] of Object.entries(urlsByService)) {
    if (Object.keys(urlsByService).length > 1) {
      urlsSection += `\n\n**${serviceName}:**`;
    }
    
    for (const urlInfo of serviceUrls) {
      const typeLabel = urlInfo.type === 'custom' ? ' (Custom Domain)' : 
                       urlInfo.type === 'static' ? ' (Static)' : '';
      urlsSection += `\n- [${urlInfo.domain}](${urlInfo.url})${typeLabel}`;
    }
  }

  return urlsSection;
}

// Handle both GitHub Actions environment and local testing
if (require.main === module) {
  run();
}

module.exports = { run };
