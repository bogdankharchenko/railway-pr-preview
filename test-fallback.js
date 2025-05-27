const { run } = require('./src/index');

// Mock GitHub Actions core functions
const mockCore = {
  getInput: (name) => {
    const inputs = {
      'railway_token': process.env.RAILWAY_TOKEN,
      'source_environment_id': process.env.RAILWAY_SOURCE_ENV_ID,
      'github_token': 'mock-github-token',
      'environment_name_prefix': 'pr-',
      'comment_on_pr': 'false', // Disable comments for testing
      'deploy_on_create': 'false', // Disable deployment for testing
      'wait_for_urls': 'false',
      'url_wait_timeout': '120',
      'is_ephemeral': 'true' // Enable ephemeral testing
    };
    return inputs[name] || '';
  },
  info: (message) => console.log(`ℹ️  ${message}`),
  warning: (message) => console.log(`⚠️  ${message}`),
  error: (message) => console.log(`❌ ${message}`),
  setFailed: (message) => console.log(`💥 FAILED: ${message}`),
  setOutput: (name, value) => console.log(`📤 Output ${name}: ${value}`)
};

// Mock GitHub context
const mockGithub = {
  context: {
    eventName: 'pull_request',
    payload: {
      action: 'opened',
      pull_request: {
        number: 999,
        head: {
          ref: 'test-ephemeral-branch'
        }
      },
      repository: {
        name: 'test-repo'
      }
    },
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    }
  },
  getOctokit: () => null // Disable GitHub API for testing
};

// Replace modules for testing
require.cache[require.resolve('@actions/core')] = {
  exports: mockCore
};
require.cache[require.resolve('@actions/github')] = {
  exports: mockGithub
};

// Test the fallback mechanism
async function testFallback() {
  console.log('🧪 Testing ephemeral environment fallback mechanism...\n');

  try {
    await run();
    console.log('\n✅ Test completed successfully!');
    console.log('🎯 The fallback mechanism should have been triggered for isEphemeral parameter');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFallback();
